import re

with open("exam.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert MathJax after <link rel="stylesheet">
head_addition = """
    <!-- MathJax Configuration -->
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            }
        };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
"""

content = re.sub(r'(rel="stylesheet">)', r'\1' + head_addition, content)

# 2. Add MathJax typesetting
typeset_func = """
        // Wait to process MathJax
        function renderQuestionWithMathJax() {
            renderQuestion();
            if (window.MathJax) {
                MathJax.typesetPromise([document.getElementById('questionText'), document.getElementById('optionsList')])
                    .catch((err) => console.error('MathJax error: ', err));
            }
        }
"""
content = re.sub(r'        // Select option', typeset_func + r'\n        // Select option', content)

# 3. Replace renderQuestion() calls in action functions
content = re.sub(
    r"(document\.getElementById\('clearBtn'\)\.addEventListener\('click', \(\) => \{\n            questions\[currentIndex\]\.answer = null;\n            questions\[currentIndex\]\.status = 'not-answered';\n            )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(document\.getElementById\('markBtn'\)\.addEventListener\('click', \(\) => \{\n            questions\[currentIndex\]\.marked = !questions\[currentIndex\]\.marked;\n            if \(questions\[currentIndex\]\.marked && questions\[currentIndex\]\.status !== 'answered'\) \{\n                questions\[currentIndex\]\.status = 'marked';\n            \}\n            )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(document\.getElementById\('prevBtn'\)\.addEventListener\('click', \(\) => \{\n            if \(currentIndex > 0\) \{ currentIndex--; )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(\} else \{\n                currentIndex\+\+;\n                )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(function goToQuestion\(index\) \{\n            currentIndex = index;\n            )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(if \(e\.key === 'ArrowLeft' && currentIndex > 0\) \{\n                currentIndex--;\n                )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(\} else if \(e\.key === 'ArrowRight' && currentIndex < questions\.length - 1\) \{\n                currentIndex\+\+;\n                )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

content = re.sub(
    r"(// Initialize first render\n        )renderQuestion\(\)",
    r"\1renderQuestionWithMathJax()", content
)

with open("exam.html", "w", encoding="utf-8") as f:
    f.write(content)
