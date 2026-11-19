---
title: What do these settings mean?
---

# What do these settings mean?

Each model has settings, sometimes called hyperparameters, that change how it learns from your data. The defaults are a sensible starting point, so you can leave every setting as it is and still train a model. Change one setting at a time, then compare the results, to see what it does.

Only settings you change are saved. A setting that does not apply to your current choices is hidden until it does, and your value for it is kept in the meantime.

## Solvers and learning rate

A **solver** is the method a model uses to find its best settings by trying, checking and adjusting over and over. **Adam** and **SGD** (stochastic gradient descent) take small steps, **L-BFGS** takes smarter steps and **coordinate descent** adjusts one value at a time.

The **learning rate** is the size of each step. Large steps learn quickly but can overshoot; small steps are steadier but slow. Adam uses a fixed learning rate of 0.001, so the learning rate can only be changed with SGD. L-BFGS and coordinate descent do not use a learning rate.

## Regularisation

**Regularisation** discourages a model from fitting the quirks of your training data, which helps it do well on new data. The **penalty** chooses how: none, L1 (which can switch unhelpful features off), L2 (which shrinks every feature a little) or elastic net (a mix of both, set with the L1 ratio).

**C** controls how strongly the model is regularised. A smaller C means stronger regularisation. L-BFGS supports only no penalty or L2, so choosing L1 or elastic net disables L-BFGS.

## Stopping

An **iteration** is one round of adjusting the model. Training stops after the maximum number of iterations, or sooner when improvement drops below the **tolerance**. A smaller tolerance asks for more precise results and usually takes longer. This app allows up to 5,000 iterations so that one fit cannot tie up your browser.

## Decision trees

A decision tree asks a series of yes-or-no questions about your data. The **criterion** is how it scores a question: Gini and entropy both measure **impurity**, which is how mixed the classes are after a split. Lower impurity means a cleaner split. The minimum impurity decrease is how much a split must improve things to be kept.

The maximum depth limits how many questions in a row the tree can ask. Unlimited trees can memorise the training data. Minimum samples to split and minimum samples per leaf stop the tree from making groups that are too small to trust.

## Nearest neighbours

A **neighbour** is one of the training rows closest to a new row. The model predicts by looking at the _k_ nearest neighbours, so a larger k gives smoother predictions. It cannot use more neighbours than there are rows in your dataset.

The **metric** is how distance is measured. Euclidean is straight-line distance, Manhattan adds up the distance along each feature, and Minkowski generalises both using the power p (p = 2 is Euclidean and p = 1 is Manhattan). The power applies only to the Minkowski metric.

## Naive Bayes

**Smoothing** adds a small amount to every count so that something never seen in training is not treated as impossible. A larger value smooths more. A **prior** is how likely each class is before looking at the features; by default the model learns priors from your data, and fitting priors can be switched off. **Binarise** turns each feature into on or off using a threshold, which Bernoulli Naive Bayes needs. Disabled means the data is already on or off.

## Support vector machines

The **kernel** decides what shape of boundary the model can draw between classes: a straight line (linear), or curves (polynomial, radial basis function and sigmoid). **Gamma** sets how far the influence of a single training row reaches for curved kernels. Scale and auto work gamma out from your data, or you can enter a value. Degree applies only to the polynomial kernel, and the independent term only to polynomial and sigmoid kernels.

A **probability estimate** adds class probabilities to the predictions, at the cost of slower training.

## Neural networks

A neural network is built from **hidden layers** of simple units. Each number in the list is one layer and its size is how many units it has. More layers and units can learn more complex patterns, but are slower and easier to overfit. The **activation** function decides how each unit responds to its inputs.

A **seed** is a starting number for the random choices the model makes. Using the same seed gives the same result every time. Leave it blank to get a different random start on each run.

## Class weights

**Class weights** make mistakes on rare classes count for more, which helps when one class is much smaller than the others. Balanced weights adjust automatically to how common each class is. None treats every row equally.

## Other settings

The **intercept** is a constant the model adds to every prediction, like where a line crosses the axis. Keep it on unless your data is already centred.
