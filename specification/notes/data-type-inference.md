## 1: CSV Ingestion & Row Tokenization

The tokenizer must adhere to **RFC 4180** while handling real-world formatting variations:

1. **Decoding & BOM Stripping:** Decode chunks as UTF-8 (`TextDecoder('utf-8')`) and strip any leading Byte Order Mark (`\uFEFF`) at byte offset `0`.
2. **Delimiter Auto-Detection:** Inspect the first complete non-empty lines (up to 20 lines) to detect the delimiter from `[",", "\t", ";", "|"]` by selecting the candidate that produces the most consistent column count greater than 1 across sampled lines (ignoring delimiters inside double quotes).
3. **Stateful Lexical Scanning:**

- Support both `\n` and `\r\n` line endings.
- Preserve delimiters and newlines enclosed within double quotes (`"..."`).
- Unescape doubled quotes (`""` $\rightarrow$ `"`) inside quoted fields.
- Trim unquoted leading/trailing whitespace around cell values unless whitespace is significant; preserve whitespace inside quoted fields.

4. **Header Normalization:**

- Extract row `0` as column headers.
- Replace empty header names with `column_{index}` (0-based).
- Deduplicate identical header names by appending `_{n}` (e.g., `id`, `id_1`, `id_2`).

5. **Ragged Row Handling:**

- If a data row has fewer fields than the header, pad missing trailing cells with `null`.
- If a data row has more fields than the header, truncate or route overflow cells to an error counter without crashing the stream.

## 2: Missing Value & Sentinel Normalization

Before evaluating a cell against any type detector, trim whitespace and compare the lowercase string against the **Missing Value Sentinel Set**:

```text
SENTINELS = { "", "null", "nan", "na", "n/a", "none", "nil", "-", "?" }

```

- **Sentinel Match Behavior:**
- Normalize the cell value to `null`.
- Increment `column.missingCount`.
- **Do not** increment `column.validCount` or `column.parseErrorCount`, and **do not** pass the value to type detectors or unique trackers.

## 3: Column Data Types & Precedence Rules

Evaluate every non-sentinel value against a strict **most-specific to least-specific precedence chain**:

```text
Boolean  ──▶  Timestamp  ──▶  Datetime  ──▶  Numeric  ──▶  Categorical  ──▶  Text

```

### 3.1 `Boolean`

- **Matching Rule:** Case-insensitive match against strictly paired binary lexicons:
- `{"true", "false"}`
- `{"t", "f"}`
- `{"yes", "no"}`
- `{"y", "n"}`
- `{"1", "0"}` (including numeric equivalents `"1.0"`, `"0.0"`)

- **Consistency Constraint:** A column must conform to a **single** lexicon pair across its rows (do not mix `"yes"` and `"1"` as the same boolean column).
- **Numeric `{0, 1}` Guardrail:** A column containing only `0` and `1` shall be typed as `Boolean` **only if** both `0` and `1` appear in the column OR `validCount` is at least `20`. Otherwise, resolve to `Numeric`.

### 3.2 `Timestamp`

- **Matching Rule:** Whole integers (or decimal epoch seconds) falling within a plausible modern epoch window (`1980-01-01T00:00:00Z` to `2050-01-01T00:00:00Z`):
- **Seconds (10 digits):** `315532800` to `2524608000`
- **Milliseconds (13 digits):** `315532800000` to `2524608000000`
- **Microseconds (16 digits):** `315532800000000` to `2524608000000000`

- **Disambiguation Guardrail:**
- Reject values with leading zeros (e.g., `"0315532800"`).
- If a column consists of 10-digit integers, apply a header heuristic (`/time|ts|epoch|created|updated|_at$/i`). If the header does not match temporal keywords and values look like phone numbers or sequential IDs, allow fallback to `Numeric` if configured, or require consistent digit-length across at least 98% of valid rows.

### 3.3 `Datetime`

- **Matching Rule:** Explicit structural date/time regex patterns—**do not** use permissive `Date.parse()` or `new Date(str)` fallbacks, which misclassify strings like `"Model 2024"` or `"10-2"`:
- **ISO-8601:** `^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$`
- **Slash / Dash Dates:** `^(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$`
- **Named Month Formats:** `^(?:\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$`

- **Calendar Validation & Format Locking:**
- Validate calendar bounds (`month` in `1..12`, `day` in `1..31`).
- For ambiguous slash/dash formats (`DD/MM/YYYY` vs `MM/DD/YYYY`), track both possibilities until a row with a day component greater than `12` locks the format (`DMY` vs `MDY`). Default to `MDY` or ISO order if never disambiguated.

### 3.4 `Numeric`

- **Matching Rule:** Matches standard integer, decimal, or scientific notation:

```regex
^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$

```

- **Optional Affix Stripping:** Strip consistent leading currency symbols (`$`, `€`, `£`), thousands separators (`,`), or trailing `%` before matching, provided the affix pattern is consistent across the column.
- **Leading-Zero Guardrail:** Reject strings with a leading `"0"` where string length is greater than `1` and no decimal point is present (e.g., `"00123"`, `"07700"`, `"01"`). These represent codes/identifiers and must fall through to `Categorical` or `Text`.

### 3.5 `Categorical`

- **Matching Rule:** Any column not resolved to `Boolean`, `Timestamp`, `Datetime`, or `Numeric` that satisfies **both** cardinality and length bounds:
- **Hybrid Cardinality Ceiling:**

```text
isCategorical = (U <= 50) OR (U <= 250 AND (U / validCount) <= 0.05)

```

where `U` is the count of distinct non-sentinel values and `validCount` is total non-sentinel rows.

- **Length Bound:** Mean character length of unique values must be at most `64` characters (prevents classifying repeated long prose blocks as categories).

- **Streaming Memory Cap:** Maintain a `Set<string>` per column. The moment `uniqueSet.size > 500`, clear the `Set` immediately to release memory and mark `column.cardinalityOverflow = true` (permanently ineligible for `Categorical`).

### 3.6 `Text`

- **Matching Rule:** Default fallback type when a column fails all primitive detectors and exceeds `Categorical` cardinality or length bounds.
- **Identifier Hint (Metadata):** Optionally set `isUniqueIdentifier: true` on `Text` columns if `(U / validCount) > 0.98` (or `cardinalityOverflow` triggered early with near-100% uniqueness) and sampled values contain no whitespace.

## 4: Single-Pass Inference & Fault-Tolerant Coercion

To avoid executing all regex detectors on every cell across millions of rows, execute inference in four phases:

### Phase A: Warm-Up Sampling (First 2,000 Valid Rows)

1. For each column, run all primitive detectors (`Boolean`, `Timestamp`, `Datetime`, `Numeric`) and update the bounded `uniqueSet` on the first `2,000` non-sentinel values.
2. At `validCount === 2000` (or at EOF if the file has fewer than 2,000 valid rows), elect a **Candidate Type** using the precedence order in Section 4, selecting the highest-precedence type with at least `98%` match rate in the warm-up window.
3. Lock any sub-format metadata discovered during warm-up (e.g., specific boolean lexicon pair, Unix epoch unit, `DMY` vs `MDY` date format, or numeric currency/percent affix).

### Phase B: Fast-Path Verification & Coercion (Rows 2,001 to $N$)

1. Use only the single compiled parser/validator corresponding to the column's elected Candidate Type.
2. Continue updating `uniqueSet` (unless `cardinalityOverflow` is already `true`) so that if a primitive type is later demoted, `Categorical` eligibility is already tracked without re-reading earlier rows.
3. For each non-sentinel cell:

- If valid: increment `validCount` and emit the coerced value (`boolean`, `number` for Numeric/Timestamp, ISO string or epoch `number` for Datetime, `string` for Categorical/Text).
- If invalid: increment `parseErrorCount` and emit `null` for that cell.

### Phase C: Dynamic Fault-Tolerance & Demotion Checkpoints

- **Anomaly Tolerance (`2%` Threshold):** A column retains its primitive type as long as:

```text
parseErrorCount / (validCount + parseErrorCount) <= 0.02

```

- **Checkpoint Evaluation:** At every `50,000` rows (and at EOF), check the error ratio.
- **Demotion Rule:** If the error ratio exceeds `0.02`, demote the column down the precedence chain:

1. If `Boolean` fails: re-test if it qualifies as `Numeric` (e.g., `{0, 1}` column that later encountered `2`, `3`); otherwise fall back to `Categorical` / `Text`.
2. If `Timestamp`, `Datetime`, or `Numeric` fails: demote to `Categorical` if `!cardinalityOverflow` and `uniqueSet.size <= 250`; otherwise demote to `Text`.

### Phase D: End-of-Stream (EOF) Finalization

Once the stream closes and final counts are known:

1. **Finalize `Categorical` vs `Text`:** Apply the hybrid cardinality check `(U <= 50) || (U <= 250 && U / validCount <= 0.05)` and mean string length check (`<= 64`). Demote `Categorical` to `Text` if the ratio check fails.
2. **Finalize `{0, 1}` `Boolean` Guardrail:** If a column was tentatively marked `Boolean` on a `{0, 1}` lexicon, verify `(sawZero && sawOne) || validCount >= 20`; otherwise finalize as `Numeric`.

## 5: Output Schema Contract

The parser must emit a schema descriptor per column alongside normalized row batches:

```typescript
export type InferredColumnType =
	| 'Boolean'
	| 'Timestamp'
	| 'Datetime'
	| 'Numeric'
	| 'Categorical'
	| 'Text';

export interface ColumnSchema {
	index: number;
	name: string;
	type: InferredColumnType;
	validCount: number;
	missingCount: number;
	parseErrorCount: number;
	uniqueCount: number | null; // null if cardinalityOverflow === true (> 500)
	cardinalityOverflow: boolean;
	detectedFormat?: {
		booleanPair?: [string, string];
		timestampUnit?: 's' | 'ms' | 'us';
		dateOrder?: 'ISO' | 'DMY' | 'MDY';
		numericAffix?: { prefix?: string; suffix?: string; hasThousandsSep?: boolean };
	};
	categories?: string[]; // Populated when type === 'Categorical'
}
```
