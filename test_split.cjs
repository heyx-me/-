const fs = require('fs');
const path = require('path');

const inputDir = 'svgs';
const outputDir = 'svgs_split';

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.svg'));

console.log(`Found ${files.length} SVG files.`);

files.forEach(file => {
    const svgFilePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);
    const svgContent = fs.readFileSync(svgFilePath, 'utf8');

    // Regex to capture the d attribute of the path
    // Handles double or single quotes, and potential surrounding attributes
    const pathRegex = /<path[^>]*d=["']([^"']+)["'][^>]*>/;
    const match = svgContent.match(pathRegex);

    if (!match) {
        console.warn('No path found in ' + svgFilePath + ', skipping.');
        return;
    }

    const fullPathData = match[1];
    
    const subpaths = splitPathData(fullPathData);
    
    // Generate new SVG
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];

    // Create path elements string
    let newPaths = '';
    subpaths.forEach((d, index) => {
        const color = colors[index % colors.length];
        newPaths += `<path id="subpath_${index}" d="${d}" fill="${color}" stroke="none" />\n`;
    });

    const header = svgContent.substring(0, svgContent.indexOf('<g'));
    const gTagMatch = svgContent.match(/<g[^>]+>/);
    const gTag = gTagMatch ? gTagMatch[0] : '<g>';
    const footer = '</g>\n</svg>';

    let finalContent = header + gTag + '\n' + newPaths + footer;

    fs.writeFileSync(outputFilePath, finalContent);
    console.log(`Processed ${file}: ${subpaths.length} subpaths`);
});

// Function to split and fix coordinates
function splitPathData(d) {
    // Potrace usually separates subpaths with 'z m' or 'z M'
    // We need to handle the whitespace and potential newlines
    // We'll use a regex to find 'z' followed by 'm'
    
    // We need to parse manually to track the start point
    const subpaths = [];
    let currentData = d;
    let startX = 0;
    let startY = 0;
    
    // Initial Move
    const initialMatch = currentData.match(/^\s*M\s*([0-9.-]+)[\s,]+([0-9.-]+)/);
    if (!initialMatch) {
        console.error('Path does not start with M');
        return [d];
    }
    
    startX = parseFloat(initialMatch[1]);
    startY = parseFloat(initialMatch[2]);
    
    // We will iterate through the string finding 'z' or 'Z'
    // And checking if there is a following 'm'
    
    let remainder = currentData;
    let safeguard = 0;
    
    while (remainder.length > 0 && safeguard < 100) {
        safeguard++;
        // Find index of first z or Z
        const zIndex = remainder.search(/[zZ]/);
        if (zIndex === -1) {
            // No more z, so this is the last part (or incomplete)
            subpaths.push(remainder);
            break;
        }
        
        // Include z in the current subpath
        const subpathPart = remainder.substring(0, zIndex + 1);
        subpaths.push(subpathPart);
        
        // Advance remainder
        remainder = remainder.substring(zIndex + 1).trim();
        
        if (remainder.length === 0) break;
        
        // Check if next command is m (relative) or M (absolute)
        // Potrace outputs relative moves 'm' after 'z' usually
        if (remainder.startsWith('m')) {
            // Parse dx dy
            const mMatch = remainder.match(/^m\s*([0-9.-]+)[\s,]+([0-9.-]+)/);
            if (mMatch) {
                const dx = parseFloat(mMatch[1]);
                const dy = parseFloat(mMatch[2]);
                
                const newX = startX + dx;
                const newY = startY + dy;
                
                // Construct new absolute M command
                const newCommand = `M ${newX} ${newY}`;
                
                // Replace 'm dx dy' with 'M newX newY' in the remainder for the next iteration's string?
                // No, we need to extract the subpath string starting with this new M
                // But wait, the subpaths list needs valid path strings.
                
                // The current remainder starts with `m dx dy ...`
                // We want to change it to `M newX newY ...` for the NEXT subpath extraction
                // But we actually just processed the PREVIOUS subpath. 
                // We pushed `subpathPart` (the previous one).
                // Now we are setting up the next one.
                
                // We strip the `m dx dy` from the remainder and prepend `M newX newY`
                // Wait, if I just replace it in the string, I can continue parsing?
                // The `m` command consumes coordinates.
                
                // Let's reconstruct the string for the next pass
                const restOfPath = remainder.substring(mMatch[0].length);
                remainder = `${newCommand}${restOfPath}`;
                
                // Update start coordinates for the NEXT subpath (relative to the NEW start)
                startX = newX;
                startY = newY;
            } else {
                console.warn('Found m but could not parse coordinates');
                subpaths.push(remainder);
                break;
            }
        } else if (remainder.startsWith('M')) {
             // Absolute move, just update startX/Y
             const mMatch = remainder.match(/^M\s*([0-9.-]+)[\s,]+([0-9.-]+)/);
             if (mMatch) {
                 startX = parseFloat(mMatch[1]);
                 startY = parseFloat(mMatch[2]);
                 // No string replacement needed
             }
        }
    }
    
    return subpaths;
}

const subpaths = splitPathData(fullPathData);

console.log(`Found ${subpaths.length} subpaths.`);

// Generate new SVG
let newSvgContent = svgContent;
const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];

// Create path elements string
let newPaths = '';
subpaths.forEach((d, index) => {
    const color = colors[index % colors.length];
    newPaths += `<path id="subpath_${index}" d="${d}" fill="${color}" stroke="none" />\n`;
});

// Replace the original path with new paths
// We need to be careful to replace only the main path we found
// We'll replace the exact string match of the d attribute
// But the d attribute in file might have newlines that regex matched?
// pathRegex matched `d="([^"]+)"`. 
// We can reconstruct the file by replacing the whole path element if we can identify it.
// Or just replace `d="..."` with the new paths (but new paths need to be separate elements).

// A simple way: remove the original path element and insert new ones.
// We'll assume the file structure is simple enough.
const parts = svgContent.split(match[0]);
// match[0] is `<path d="...` (incomplete tag). 
// We need to find the end of the tag `/>` or `></path>`.
// Potrace usually output: `<path d="..."
//fill="..." stroke="..." />`

// Let's just create a new file content manually using the header and footer from original
// or try to inject.

// Simplest for visualization:
// Replace the entire `<g ...>` block content?
// The file has `<g transform...>` then paths.
// Let's just dump the new paths into a new file structure.

const header = svgContent.substring(0, svgContent.indexOf('<g'));
const gTagMatch = svgContent.match(/<g[^>]+>/);
const gTag = gTagMatch ? gTagMatch[0] : '<g>';
const footer = '</g>\n</svg>';

let finalContent = header + gTag + '\n' + newPaths + footer;

fs.writeFileSync(outputFilePath, finalContent);
console.log('Written split SVG to ' + outputFilePath);
