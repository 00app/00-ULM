import re

with open('app/globals.css', 'r') as f:
    content = f.read()

# We want to remove lines like `opacity: 0.9;`
# But only for specific classes, or we can just remove all simple opacity: 0.X; lines
# that aren't inside keyframes. Actually, let's just target the ones in `.card-headline`, 
# `.data-label`, `.data-value`, `.card-top-label`, `.card-top-arrow` etc. 
# Alternatively, since the user said "Remove any opacity on anything of all way full colour",
# we can just remove all `opacity: 0.\d+;` that match `opacity: 0.[0-9]+;` 

content = re.sub(r'^\s*opacity:\s*0\.[0-9]+;\s*\n', '', content, flags=re.MULTILINE)

with open('app/globals.css', 'w') as f:
    f.write(content)
