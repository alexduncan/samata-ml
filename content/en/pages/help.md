---
title: Help & Guide
---

# Help & Guide

Follow the standard 4-step workflow:

1. **Load Data:** Select a sample dataset or upload a CSV file.
2. **Set Target:** Choose the column you want your models to predict.
3. **Train Models:** Configure features, algorithms, and hyperparameters.
4. **Compare Results:** Evaluate and compare accuracy, F1-score, and curves across models.

## Data and model choices

### File and column types

- **Comma-separated values (CSV).** A plain-text file that stores a table, usually with commas between values.
- **Categorical, category and class.** A categorical column groups rows by a value such as a species name. When a model predicts a category, each possible answer is called a class.
- **Numeric, Boolean, Date and time, and Text.** A numeric column holds numbers. A Boolean column holds two values, true and false. A date column holds calendar dates. A time column holds times of day. A date and time column holds a moment, shown in UTC. A text column holds written values.
- **Coordinated Universal Time (UTC).** A common time reference used to show dates and times consistently across time zones.

### Inspecting data

- **Empty (missing) and Invalid.** A missing value was left empty or uses a recognised placeholder for missing data. An invalid value is present but does not fit the column’s detected type.
- **Distinct values and Constant.** Distinct values are the different values that appear. A constant column has the same value wherever a value is present.
- **Identifier and Identifier candidate.** An identifier names an individual row or item. A column with a different value for every row may be an identifier.
- **Min, Max, Median and Mean.** Minimum and maximum are the smallest and largest values. The median is the middle value in order, or the average of the middle two values when there are an even number. The mean is the sum divided by the number of values.
- **Histogram, range and count.** A histogram groups numbers into ranges. The count tells you how many values fall in a range.
- **Freq. and %.** Frequency is how many times a category appears. In the inspector, its percentage is the count divided by the number of non-missing values.

### Choosing what to predict

- **Target and Feature.** The target is the column you want to predict. A feature is a column the model uses to make that prediction.
- **Target leakage.** An input gives away the answer or uses information that would be unavailable when making a real prediction.
- **Classification and Regression.** Classification predicts a category. Regression predicts a number. This workflow currently trains classifiers.
- **Model and Algorithm.** A model uses patterns learned from data to make predictions. An algorithm is the method used to learn those patterns.
