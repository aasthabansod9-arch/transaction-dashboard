"""Assemble docs/index.html from src/ plus the packed data (run scripts/pack.py first).

Usage (from the repository root): python3 scripts/build.py
"""
import os

S = 'src/'
meta = open('build/meta.json').read()
pack = open('build/data.b64').read()
css = open(S + 'style.css').read()
body = open(S + 'body.html').read()
js = ''.join(open(S + f).read() + '\n' for f in ['core.js', 'stats.js', 'charts1.js', 'charts2.js', 'ui.js'])

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Transaction Performance Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{css}
</style>
</head>
<body>
{body}
<script src="d3.min.js"></script>
<script type="application/json" id="meta">{meta}</script>
<script type="text/plain" id="pack">{pack}</script>
<script>
{js}
</script>
</body>
</html>
"""
os.makedirs('docs', exist_ok=True)
open('docs/index.html', 'w').write(html)
print('docs/index.html', round(len(html) / 1e6, 2), 'MB')
