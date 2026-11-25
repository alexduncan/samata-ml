---
title: What are features?
---

A **feature** is a column the model uses to make a prediction. The **target** is the column you want the model to predict. Choose features you could measure or know when you need to make a prediction.

## An example from the Iris dataset

Each row describes one flower. If the target is the flower’s species, petal length and petal width are useful features. Those measurements can help the model tell species apart. A row number identifies a record and usually gives the model little useful information about a new flower.

## Watch out for data leakage

**Data leakage** happens when a feature gives the model information it would only have after the prediction, or gives away the answer. For example, a second column containing the species name would let the model read the answer when you check it. On a flower with no species label, it could no longer use that shortcut. Leave out columns that copy the target or are only filled in after the answer is known.
