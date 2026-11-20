---
title: Training Setup
---

## One-Shot Training

One-Shot requests a single split of your labelled data: 80% for training and 20% for testing. The split is stratified, which means it aims to keep the proportion of each class similar in both groups. The fixed random seed of 42 makes the split reproducible with the same data and settings.

The test rows are held out during training. They let you check how well the fitted model predicts labels for rows it has never seen.

## Cross-Validation

Cross-validation divides the labelled data into groups called folds. With manual settings, each fold takes one turn as the validation set. In each round, the other folds are used for training. More folds mean more rounds of fitting and evaluating the model, which can take longer.

The matrix shows which folds are used for training and validation in each round. Its percentages illustrate the proportions for equal-sized folds. Actual row assignments and group sizes depend on your data.

## How many folds can I choose?

Training setup requires at least two observed classes with at least two labelled rows each. The smallest class limits the number of folds you can select, up to a maximum of ten. This is a rule for choosing settings. Training may still reject a setup when a class is very small.

Nested cross-validation for tuning needs enough rows in each outer training set to split it again. For example, four rows in the smallest class allow four manual folds under the setup rule. Each outer training set then contains three rows from that class, too few for four inner folds.
