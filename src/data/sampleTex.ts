/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SAMPLE_TEX_CONTENT = `% JEE CBT Sample Mock Test File
% This file complies exactly with the required parser contract.

\\begin{quizquestion}{Q1}
  \\subject{Physics}
  \\topic{Electrostatics}
  \\answertype{mcq}
  \\marks{4}
  \\difficulty{medium}
  
  Three charges $+q$, $+q$, and $-2q$ are placed at the vertices of an equilateral triangle of side $a$. 
  The electric dipole moment of the system is:
  
  \\option{$\\sqrt{3} q a$}
  \\option{$2 q a$}
  \\option{$\\sqrt{2} q a$}
  \\option{$q a$}
  
  \\correctoption{$\\sqrt{3} q a$}
\\end{quizquestion}

\\begin{quizquestion}{Q2}
  \\subject{Physics}
  \\topic{Current Electricity}
  \\answertype{numerical}
  \\marks{4}
  \\difficulty{easy}
  
  A copper wire of resistance $R$ is stretched to twice its original length. 
  Assuming the density of copper remains constant, find the ratio of the new resistance to the original resistance $R'/R$.
  
  \\correctvalue{4}
  \\tolerance{0}
\\end{quizquestion}

\\begin{quizquestion}{Q3}
  \\subject{Physics}
  \\topic{Mechanics}
  \\answertype{subjective}
  \\marks{4}
  \\difficulty{hard}
  
  State the law of conservation of angular momentum and explain why a diver curls their body when jumping off a diving board.
  
  \\modelanswer{
    The law of conservation of angular momentum states that if the net external torque acting on a system is zero, the total angular momentum of the system remains constant ($L = I\\omega = \\text{constant}$).
    
    When a diver jumps off a board and curls their body, they bring their limbs closer to the axis of rotation, thereby decreasing their moment of inertia ($I$). To conserve angular momentum, their angular velocity ($\\omega$) must increase proportionally, allowing them to perform more flips before hitting the water.
  }
\\end{quizquestion}

\\begin{quizquestion}{Q4}
  \\subject{Chemistry}
  \\topic{Chemical Bonding}
  \\answertype{mcq}
  \\marks{4}
  \\difficulty{easy}
  
  Which of the following molecules exhibits $sp^3d$ hybridization for its central atom?
  
  \\option{$PCl_5$}
  \\option{$SF_6$}
  \\option{$CH_4$}
  \\option{$BF_3$}
  
  \\correctoption{$PCl_5$}
\\end{quizquestion}

\\begin{quizquestion}{Q5}
  \\subject{Chemistry}
  \\topic{Chemical Kinetics}
  \\answertype{numerical}
  \\marks{4}
  \\difficulty{medium}
  
  For a first-order reaction, the rate constant is $k = 0.03$ $\\text{s}^{-1}$. 
  Calculate the half-life ($t_{1/2}$) of this reaction in seconds. (Round to two decimal places, using $\\ln(2) \\approx 0.6931$).
  
  \\correctvalue{23.10}
  \\tolerance{0.2}
\\end{quizquestion}

\\begin{quizquestion}{Q6}
  \\subject{Chemistry}
  \\topic{Thermodynamics}
  \\answertype{subjective}
  \\marks{4}
  \\difficulty{medium}
  
  Define Gibbs Free Energy ($G$) and explain its relation to chemical spontaneity under constant temperature and pressure conditions.
  
  \\modelanswer{
    Gibbs Free Energy ($G$) is a thermodynamic potential defined as $H - TS$, where $H$ is enthalpy, $T$ is absolute temperature, and $S$ is entropy. It represents the maximum reversible work that can be performed by a thermodynamic system at constant temperature and pressure.
    
    The change in Gibbs Free Energy ($\\Delta G$) determines reaction spontaneity:
    - If $\\Delta G < 0$, the reaction is spontaneous (exergonic).
    - If $\\Delta G = 0$, the reaction is at dynamic equilibrium.
    - If $\\Delta G > 0$, the reaction is non-spontaneous (endergonic).
  }
\\end{quizquestion}

\\begin{quizquestion}{Q7}
  \\subject{Mathematics}
  \\topic{Calculus}
  \\answertype{mcq}
  \\marks{4}
  \\difficulty{hard}
  
  Evaluate the following limit:
  \\[
  \\lim_{x \\to 0} \\frac{e^{x^2} - \\cos(x)}{x^2}
  \\]
  
  \\option{$3/2$}
  \\option{$1/2$}
  \\option{$1$}
  \\option{$2$}
  
  \\correctoption{$3/2$}
\\end{quizquestion}

\\begin{quizquestion}{Q8}
  \\subject{Mathematics}
  \\topic{Matrices and Determinants}
  \\answertype{numerical}
  \\marks{4}
  \\difficulty{medium}
  
  Let $A$ be a $3 \\times 3$ matrix such that $\\det(A) = 5$. Find the value of $\\det(2A)$.
  
  \\correctvalue{40}
  \\tolerance{0}
\\end{quizquestion}

\\begin{quizquestion}{Q9}
  \\subject{Mathematics}
  \\topic{Probability}
  \\answertype{subjective}
  \\marks{4}
  \\difficulty{medium}
  
  Explain Bayes' Theorem and write down its general mathematical formula for two events $A$ and $B$.
  
  \\modelanswer{
    Bayes' Theorem describes the probability of an event, based on prior knowledge of conditions that might be related to the event. It updates the prior probability of an event $A$ when new evidence or event $B$ occurs.
    
    The formula is:
    \\[
    P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}
    \\]
    where:
    - $P(A|B)$ is the posterior probability of $A$ given $B$.
    - $P(B|A)$ is the likelihood of $B$ given $A$.
    - $P(A)$ is the prior probability of $A$.
    - $P(B)$ is the prior marginal probability of $B$.
  }
\\end{quizquestion}
`;
