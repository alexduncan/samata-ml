# Project Vision and Architectural Principles

**Status:** reference (product intent; not an implementation contract)

## Why web-ml-app exists

`web-ml-app` is a browser based app for training machine learning models primarily for the purpose of education. All model training is provided by the sister repository `web-ml`. This library provides a user interface to upload or select datasets, choose hyperparameters, run training and display results in a clear and user-friendly interface.

## High Level Requirements

### 1. Zero-Install

Pure client side WebApp eliminating the friction of package dependency management and environment configuration experiences in computational notebooks (e.g. Jupyter).

### 2. No-Code Workflow

The app workflow must require zero programming syntax to help non-technical students understand the mechanisms of machine learning.

### 3. Cognitive Load Alignment

The machine learning models will seamlessly handle the mathematical calculations removing extraneous cognitive load that doesn't contribute to the conceptual or ethical learning objective. The app interface must give users conceptual levers. Users must be required to make a decision on the ML model to train, target variable, features and hyperparameters.

### 4. Progressive Disclosure and Plain-English Guidance

Larners require different levels of simplification. Oversimplifying some concepts risks causing ‘expertise reversal’ among experienced software developers. Technical terms and complexity shouldn’t be completely hidden, but always accompanied by plain-English jargon-free definitions. Mathematical formulas and algorithms should be available for users who want to dig deeper.

### 5. Appropriate Visualisations

Rather than requiring learners to configure visualisations, the tool must generate interactive visualisations matched to the specific model and task. For example displaying decision boundaries and confusion matrices when training logistic regression. The charts should still require learners to manipulate and interpret them instead of just being passive viewers.

## B. Normative and Responsible AI Requirements

### 6. Consequential Sociotechnical Context

Learners must be able to train models on ethical decision scenarios using well studied datasets such as Folktables, COMPAS or German Credit.

### 7. Direct Manipulation with Epistemic Friction and Consequential Feedback

Users must be in control of the results and quickly see visible changes based on their choices and parameter adjustments. The app will be built around a a structured workflow to prevent cognitive offloading through just passively clicking buttons.

### 8. Probabilistic Threshold Calibration and Fairness Auditing

Users should see decisions as predicted probabilities and be able to adjust the threshold using a slider to see in realtime how it affects the rate of False Positives and False Negatives. The workflow should expose the learners to questions of fairness that the model visualisations cannot answer.

## C. Methodological and Algorithmic Integrity Requirements

### 9. Explainable Classical Models Contrasted with an Opaque Neural Network

The tool should prioritise supporting inspectable supervised classification and regression models where the decision splits can be directly visualised. Alongside these models the tool should provide at least one neural network model as a comparison so learners can directly experience the structural opacity.

### 10. Enforced Methodological Rigour

Implementation of machine learning algorithms in both student projects and academic research are plagued by methodological errors such as data leakage or pre-processing validation folds. The machine learning models must be implemented with academic rigour and the interface should enforce users to use training, testing and validation folds.

## D. Non-Functional Architectural, Accessibility and Sustainability Requirements

### 11. Accessibility by Design:

The app must conform to Web Content Accessibility Guidelines (WCAG), provide full keyboard operability, accessible color palettes and sufficient contrast.

### 12. Privacy, Responsiveness, and Open-Source Longevity

**Local Execution:** All data processing and model training must execute locally in the user's browser preserving privacy by not sending datasets to the cloud.

**Digital-divide responsiveness:** After the initial static code is sent from the server to the user’s browser, the rest of the application must operate efficiently on a commodity laptop without using excessive bandwidth. Machine learning models will leverage modern browser features to accelerate heavy computation.

**Open-source:** To ensure this proof-of-concept prototype doesn’t join other abandoned academic projects, both the application and the underlying machine learning models will be released as an open source project. This will support independent scrutiny, reuse of the code and allow external contribution.
