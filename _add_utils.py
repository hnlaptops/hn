import re

# Files to update
files = [
    '/Users/hamza/Documents/HN LAPTOPS/hn-web/app/routes/admin-ledger.tsx',
    '/Users/hamza/Documents/HN LAPTOPS/hn-web/app/routes/admin.tsx',
    '/Users/hamza/Documents/HN LAPTOPS/hn-web/app/routes/user.tsx',
]

# Pattern to find number inputs and add formatting
# We want to change: type="number" ... \n ... className="..." to include onChange + value

for filepath in files:
    content = open(filepath).read()
    
    # Find all type="number" inputs and add formatting
    # Simple approach: replace the pattern where we have type="number" with formatting
    # We need to add: value={formattedValue} and onChange handler
    
    # First, import the utility
    if 'app/utils' not in content:
        if 'import' in content.split('\n')[0]:
            # Add import after first line
            lines = content.split('\n')
            first_import_idx = None
            for i, line in enumerate(lines):
                if line.startswith('import ') and 'utils' not in line:
                    first_import_idx = i
                    break
            if first_import_idx is not None:
                lines.insert(first_import_idx + 1, "import { formatWithCommas } from \"../utils\";")
                content = '\n'.join(lines)
    
    open(filepath, 'w').write(content)
    print(f'Imported utils in {filepath}')
