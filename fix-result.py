import re

with open("result.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert MathJax after <link href="...">
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

content = re.sub(r'(<title>.*?</title>)', r'\1' + head_addition, content)


# 2. Call MathJax typeset
typeset_call = """
            if (window.MathJax) {
                MathJax.typesetPromise([document.getElementById('solutionsList')])
                    .catch((err) => console.error('MathJax error: ', err));
            }
"""

content = re.sub(r"(container\.innerHTML = filtered\.map\(\(r, i\) => \{.*?\n        \}\)", r"\1\n" + typeset_call, content, flags=re.DOTALL)


with open("result.html", "w", encoding="utf-8") as f:
    f.write(content)

