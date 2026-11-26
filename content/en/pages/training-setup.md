---
title: Training Setup
---

## One-Shot Training

Train once on one part of the data and test on the part set aside. One-Shot requests a single split of your labelled data, with 80% for training and 20% for testing. The training rows teach the model. The test rows are set aside to check how it performs on other rows.

The split is **stratified**. A stratified split tries to keep the shares of each class similar in the groups. The fixed random seed of 42 makes the split reproducible with the same data and settings.

The test rows are held out during training. **Held-out rows** are rows left out of training for the model that made those predictions.

## Cross-Validation

Divide the data into groups, then train and check a model several times, using a different group for the check each time. A **fold** is one group of rows in cross-validation. The **validation fold** is the group set aside for one check. With manual settings, each fold takes one turn as the validation set. In each round, the other folds are used for training. More folds mean more rounds of fitting and evaluating the model, which can take longer.

The matrix shows which folds are used for training and validation in each round. Its percentages illustrate the proportions for equal-sized folds. Actual row assignments and group sizes depend on your data.

To **refit**, train the final model again using all the eligible rows after cross-validation has checked performance. The displayed held-out scores come from the validation folds used before refitting.

## Choosing a training strategy

| Strategy         | Benefits                                                                           | Drawbacks                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| One-Shot         | Trains once, so it is quicker and simpler to follow.                               | The score depends on which rows land in the single test group.                               |
| Cross-Validation | Checks every row in a held-out group once, so the score depends less on one split. | Trains several times, so it takes longer. Small classes limit how many folds you can choose. |

## How many folds can I choose?

Training setup requires at least two observed classes with at least two labelled rows each. The smallest class limits the number of folds you can select, up to a maximum of ten. This is a rule for choosing settings. Training may still reject a setup when a class is very small.

Nested cross-validation for tuning needs enough rows in each outer training set to split it again. For example, four rows in the smallest class allow four manual folds under the setup rule. Each outer training set then contains three rows from that class, too few for four inner folds.
