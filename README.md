# JEE CBT Simulator

```
    /\_/\
   ( o.o )
    > ^ <
   /|   |\
  (_|   |_)
```

A comprehensive Computer-Based Test (CBT) simulator for JEE Main examination, built with TypeScript. This project creates an accurate 1:1 replica of the JEE Main exam environment using LaTeX-generated content.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Content Generation](#content-generation)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## 🎯 Overview

The JEE CBT Simulator is a modern, full-featured exam preparation platform designed to replicate the official JEE Main Computer-Based Test environment. By leveraging LaTeX (.tex) files for content generation, the simulator provides high-quality, mathematically-rendered questions with precise formatting that matches the actual exam interface.

This tool is essential for:
- **Students** preparing for JEE Main examinations
- **Educators** looking to create practice tests
- **Institutions** conducting mock exams and assessments

## ✨ Features

### Core Functionality
- **Authentic Exam Interface**: Replicates the official JEE Main CBT environment
- **Multiple Question Types**: Single Correct, Multiple Correct, Numerical Value, and Matrix Match questions
- **LaTeX Integration**: Renders complex mathematical equations and scientific notation accurately
- **Adaptive Testing**: Questions spanning Physics, Chemistry, and Mathematics
- **Real-time Timer**: Accurate exam duration tracking (180 minutes)
- **Answer Sheet Management**: Digital OMR sheet simulation
- **Automatic Scoring**: Instant result calculation with detailed analysis

### Advanced Features
- **Question Bank**: Extensive repository of curated questions
- **Mock Tests**: Full-length practice tests following official JEE Main pattern
- **Performance Analytics**: Detailed score reports and topic-wise analysis
- **Responsive Design**: Optimized for desktop and tablet devices
- **Accessibility**: WCAG-compliant interface for inclusive access

## 🛠️ Technology Stack

- **Language**: TypeScript (99.2%)
- **Runtime**: Node.js
- **Content Format**: LaTeX (.tex files)
- **Additional Technologies**: Other (0.8%)

### Development Dependencies
- TypeScript Compiler
- Build and testing frameworks
- Linting and code quality tools

## 📁 Project Structure

```
JEE-CBT-simulator-/
├── src/                          # Source code directory
│   ├── components/              # React/UI components
│   ├── utils/                   # Utility functions
│   ├── types/                   # TypeScript type definitions
│   └── services/                # Business logic services
├── content/                      # LaTeX content files
│   ├── questions/               # Question .tex files
│   ├── templates/               # Exam template files
│   └── compiled/                # Compiled PDF/HTML output
├── tests/                        # Test suite
├── docs/                         # Documentation
├── .gitignore
├── tsconfig.json               # TypeScript configuration
├── package.json                # Project dependencies
└── README.md                   # This file
```

## 🚀 Installation

### Prerequisites
- **Node.js** (v16.0 or higher)
- **npm** or **yarn** package manager
- **LaTeX** (for content compilation)

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/legendary-monk/JEE-CBT-simulator-.git
   cd JEE-CBT-simulator-
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure LaTeX Engine** (if needed)
   ```bash
   # Ensure pdflatex or xelatex is installed
   which pdflatex
   ```

4. **Build the Project**
   ```bash
   npm run build
   ```

5. **Start the Application**
   ```bash
   npm start
   ```

The simulator will be available at `http://localhost:3000`

## 📖 Usage

### Running an Exam

1. **Launch the Application**: Navigate to the home page
2. **Select Test Type**: Choose from available mock tests or practice sets
3. **Begin Exam**: Start the test with the timer activated
4. **Answer Questions**: 
   - Single Correct: Select one option
   - Multiple Correct: Select multiple correct options
   - Numerical Value: Enter the calculated answer
   - Matrix Match: Match rows with columns
5. **Review & Submit**: Review answers and submit the test
6. **View Results**: Access detailed score analysis and solutions

### Example Exam Flow

```
Home → Select Test → Start Timer → Answer Questions → Submit → View Results
```

## 🧪 Content Generation

### Creating Questions from LaTeX

1. **Create `.tex` File** in `content/questions/`
   ```latex
   \documentclass{article}
   \usepackage{amsmath}
   
   \begin{document}
   
   \section*{Question Type: Single Correct}
   
   The roots of $x^2 - 5x + 6 = 0$ are:
   
   \begin{enumerate}
     \item $2$ and $3$
     \item $-2$ and $-3$
     \item $1$ and $6$
     \item $2$ and $-3$
   \end{enumerate}
   
   \end{document}
   ```

2. **Compile to Web Format**
   ```bash
   npm run compile:content
   ```

3. **Register in Question Bank**: Update the question registry configuration

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Exam Settings
EXAM_DURATION=180
TOTAL_QUESTIONS=90
PHYSICS_QUESTIONS=30
CHEMISTRY_QUESTIONS=30
MATHEMATICS_QUESTIONS=30

# LaTeX Configuration
LATEX_COMPILER=pdflatex
CONTENT_PATH=./content/questions
```

### Exam Configuration

Edit `config/exam.config.json` to customize:
- Exam duration
- Number of questions
- Question distribution by subject
- Marking scheme
- Difficulty levels

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit Your Changes**
   ```bash
   git commit -m "Add detailed description of changes"
   ```
4. **Push to Branch**
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** with a clear description

### Contribution Areas
- New question content
- Bug fixes and improvements
- UI/UX enhancements
- Performance optimizations
- Documentation updates
- Test coverage expansion

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Contact

For questions, suggestions, or support:

- **GitHub Issues**: [Report issues here](https://github.com/legendary-monk/JEE-CBT-simulator-/issues)
- **Repository**: [legendary-monk/JEE-CBT-simulator-](https://github.com/legendary-monk/JEE-CBT-simulator-)

## 🙏 Acknowledgments

- JEE Main examination structure and guidelines
- LaTeX community for content rendering
- All contributors and users of this simulator

---

**Happy Studying!** 📚

For the latest updates and versions, visit the [repository](https://github.com/legendary-monk/JEE-CBT-simulator-).
