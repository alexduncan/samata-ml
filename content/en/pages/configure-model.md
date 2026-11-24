---
title: What do these settings mean?
---

# What do these settings mean?

A **hyperparameter** is a setting chosen before training that controls how the model learns. **Manual** means you choose the settings. **Random search** tries different combinations drawn from ranges or options you choose. Random Search is currently unavailable in this form.

The defaults are a sensible starting point, so you can leave every setting as it is and still train a model. Change one setting at a time, then compare the results, to see what it does.

Only settings you change are saved. A setting that does not apply to your current choices is hidden until it does, and your value for it is kept in the meantime.

## Solvers and learning rate

The **solver** is the method used to fit the model’s weights or other learned parameters. Stochastic gradient descent (**SGD**) and limited-memory Broyden–Fletcher–Goldfarb–Shanno (**L-BFGS**) are methods for taking steps towards a better fit. SGD uses a direction based on the current slope. L-BFGS also uses information from recent steps to choose the next one. **Adam** also takes small steps, and **coordinate descent** adjusts one value at a time.

The **learning rate** determines how large a step the model takes each time it adjusts its weights during training. Large steps can learn quickly and may overshoot. Small steps are steadier and slower. Adam uses a fixed learning rate of 0.001, so the learning rate can only be changed with SGD. L-BFGS and coordinate descent do not use a learning rate.

## Regularisation

A **penalty** makes some fitted models cost more during training. **Regularisation** uses that penalty to limit how strongly the model fits the training rows. **L1** can shrink some input weights to zero. **L2** shrinks weights towards zero. **Elastic Net** mixes the two, with the mix set by the L1 ratio. Choose **None** to train without a penalty.

**C** controls how strongly the model is regularised. A smaller C means stronger regularisation. L-BFGS supports only no penalty or L2, so choosing L1 or elastic net disables L-BFGS.

## Stopping

An **iteration** is one step of the solver. **Tolerance** helps decide when further steps are making too little difference to continue. The exact stopping check depends on the solver. A smaller tolerance asks for more precise results and usually takes longer. This app allows up to 5,000 iterations so that one fit cannot tie up your browser.

## Decision trees

A decision tree asks a series of yes-or-no questions about your data. **Impurity** measures how mixed the classes are in a group of rows. A split **criterion** is the rule a tree uses to score possible splits. Gini and entropy both measure impurity. Lower impurity means a cleaner split. The minimum impurity decrease is how much a split must improve things to be kept.

The maximum depth limits how many questions in a row the tree can ask. Unlimited trees can memorise the training data. Minimum samples to split and minimum samples per leaf stop the tree from making groups that are too small to trust.

## Nearest neighbours

**Neighbours** are the training rows closest to a new row. The model predicts by looking at the _k_ nearest neighbours, so a larger k gives smoother predictions. It cannot use more neighbours than there are rows in your dataset.

A **distance metric** defines how that closeness is measured. Euclidean is straight-line distance. Manhattan adds up the distance along each feature. Minkowski generalises both using the power p (p = 2 is Euclidean and p = 1 is Manhattan). The power applies only to the Minkowski metric.

## Naive Bayes

**Smoothing** reduces the effect of values or combinations that rarely occur. Count smoothing can keep an unseen combination from getting a zero estimate. Gaussian variance smoothing keeps estimated spreads from becoming too small. A larger value smooths more.

**Priors** are the starting chances assigned to the classes before looking at a row’s inputs. By default the model learns priors from your data, and fitting priors can be switched off.

**Binarise** means to turn a value into one of two values according to which side of a cutoff it falls on. Bernoulli Naive Bayes needs on or off values. Turn binarisation off when the data is already on or off.

## Support vector machines

A **kernel** is the rule the classifier uses to compare rows. The linear kernel draws a straight boundary between classes. Polynomial, radial basis function and sigmoid kernels can draw curves. A radial basis function (**RBF**) gives more influence to nearby rows. **Gamma** controls how quickly the influence of a row falls away with distance for a radial basis kernel. For other kernels its role depends on the kernel. Scale and auto work gamma out from your data, or you can enter a value. Degree applies only to the polynomial kernel, and the independent term only to polynomial and sigmoid kernels.

**Probability estimates** are the model’s estimated chances for the possible answers. Enabling them for a support vector classifier takes longer to train.

## Neural networks

**Hidden layers** are groups of neurons between the input and prediction that learn intermediate patterns. Each number in the list is one layer and its size is how many neurons it has. More layers and neurons can learn more complex patterns, but are slower and easier to overfit.

An **activation function** changes a neuron’s input into its output. Rectified linear unit (**ReLU**) keeps positive inputs and turns negative inputs into zero. Hyperbolic tangent (**tanh**) maps values to a scale between minus one and one.

A **seed** is a starting number for a repeatable sequence of random choices. Leave it blank to get a different random start on each run.

## Class weights

**Class weights** are settings that decide how much examples of each class count during training. Balanced weights adjust automatically to how common each class is. None treats every row equally.

## Predicting more than two classes

**Multiclass** means there are more than two possible answers. **One-vs-Rest** learns to separate each class from all the others. **One-vs-One** learns to separate each pair of classes.

## Other settings

The **intercept** is a starting offset added to the model’s score before counting the effects of its inputs. Keep it on unless your data is already centred.
