#!/bin/bash
# Script to update PocketOption links

OLD_LINK="https://po-ru4.click?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1724298&ac=users&cid=923101&code=WELCOME50"
NEW_LINK="https://po-ru4.click/register?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1686579&ac=users&cid=923101&code=WELCOME50"

cd "/Users/sergeyzhurakovsky/Desktop/Neura frontend/neura/web"

# Update all tsx and ts files
find . -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s|$(echo "$OLD_LINK" | sed 's/[&/]/\\&/g')|$(echo "$NEW_LINK" | sed 's/[&/]/\\&/g')|g" {} +

echo "✅ Links updated!"
grep -r "po-ru4.click" --include="*.tsx" --include="*.ts" | head -5
