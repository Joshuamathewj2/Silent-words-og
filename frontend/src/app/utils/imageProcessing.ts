/**
 * Image Processing Utilities
 * Optimized for performance in the browser loop.
 */

// Convert RGBA to Grayscale
export function toGrayscale(imgData: ImageData): ImageData {
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = avg;     // R
        data[i + 1] = avg; // G
        data[i + 2] = avg; // B
    }
    return imgData;
}

// Simple Box Blur (Approximates Gaussian for small radii)
// 3-pass box blur is mathematically close to Gaussian
export function boxBlur(imgData: ImageData, radius: number): ImageData {
    // We'll convert to a single channel array for processing to speed it up, then map back
    // Or just process R channel since it's grayscale
    const width = imgData.width;
    const height = imgData.height;
    const data = imgData.data;

    const size = width * height;
    const channelMap = new Uint8ClampedArray(size);

    // Extract Grayscale (R channel)
    for (let i = 0; i < size; i++) {
        channelMap[i] = data[i * 4];
    }

    const processed = fastBlur(channelMap, width, height, radius);

    // Write back
    for (let i = 0; i < size; i++) {
        const val = processed[i];
        data[i * 4] = val;
        data[i * 4 + 1] = val;
        data[i * 4 + 2] = val;
    }

    return imgData;
}

// 1D Gaussian-like Blur (Approx logic)
function fastBlur(source: Uint8ClampedArray, w: number, h: number, r: number) {
    const output = new Uint8ClampedArray(source.length);
    // Horizontal
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0;
            let count = 0;
            for (let k = -r; k <= r; k++) {
                const px = Math.min(Math.max(x + k, 0), w - 1);
                sum += source[y * w + px];
                count++;
            }
            output[y * w + x] = sum / count;
        }
    }

    // Vertical (on the output of pass 1 to mimic 2D kernel)
    const output2 = new Uint8ClampedArray(source.length);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let sum = 0;
            let count = 0;
            for (let k = -r; k <= r; k++) {
                const py = Math.min(Math.max(y + k, 0), h - 1);
                sum += output[py * w + x];
                count++;
            }
            output2[y * w + x] = sum / count;
        }
    }
    return output2;
}

// Adaptive Thresholding logic
export function adaptiveThreshold(imgData: ImageData, constant: number = 2): ImageData {
    const w = imgData.width;
    const h = imgData.height;

    // Create blurred version for local mean
    const blurredClone = new ImageData(
        new Uint8ClampedArray(imgData.data),
        w,
        h
    );
    // Apply a heavier blur to act as the "neighborhood mean"
    boxBlur(blurredClone, 5);

    const data = imgData.data;
    const meanData = blurredClone.data;

    for (let i = 0; i < data.length; i += 4) {
        const pixelVal = data[i];
        const localMean = meanData[i];

        // Inverted: Foreground (Hand) -> Black (0), Background -> White (255)
        // Matches training data
        if (pixelVal > (localMean - constant)) {
            data[i] = 255;   // Background -> White
            data[i + 1] = 255;
            data[i + 2] = 255;
        } else {
            data[i] = 0;     // Foreground -> Black
            data[i + 1] = 0;
            data[i + 2] = 0;
        }
    }
    return imgData;
}

// --- MORPHOLOGICAL OPERATIONS ---

export function dilate(imgData: ImageData, radius: number = 1): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const input = new Uint32Array(imgData.data.buffer);
    const output = new Uint32Array(input.length);
    const outputData = new ImageData(new Uint8ClampedArray(output.buffer), w, h);

    // MAX FILTER 
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let maxVal = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const py = Math.min(Math.max(y + ky, 0), h - 1);
                    const px = Math.min(Math.max(x + kx, 0), w - 1);
                    const idx = py * w + px;
                    const val = input[idx] & 0xFF;
                    if (val > maxVal) maxVal = val;
                }
            }
            const idx = y * w + x;
            output[idx] = 0xFF000000 | (maxVal << 16) | (maxVal << 8) | maxVal;
        }
    }
    return outputData;
}

export function erode(imgData: ImageData, radius: number = 1): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const input = new Uint32Array(imgData.data.buffer);
    const output = new Uint32Array(input.length);
    const outputData = new ImageData(new Uint8ClampedArray(output.buffer), w, h);

    // MIN FILTER
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let minVal = 255;
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const py = Math.min(Math.max(y + ky, 0), h - 1);
                    const px = Math.min(Math.max(x + kx, 0), w - 1);
                    const idx = py * w + px;
                    const val = input[idx] & 0xFF;
                    if (val < minVal) minVal = val;
                }
            }
            const idx = y * w + x;
            output[idx] = 0xFF000000 | (minVal << 16) | (minVal << 8) | minVal;
        }
    }
    return outputData;
}

export function removeNoise(imgData: ImageData): ImageData {
    let result = dilate(imgData, 1);
    result = erode(result, 1);
    return result;
}

export function fillGaps(imgData: ImageData): ImageData {
    let result = erode(imgData, 2);
    result = dilate(result, 2);
    return result;
}

// --- CONTOUR FILTERING ---

export function keepLargestContour(imgData: ImageData): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const labels: number[] = new Array(w * h).fill(0);

    let currentLabel = 1;
    const labelSizes: Record<number, number> = {};

    for (let i = 0; i < w * h; i++) {
        const isBlack = data[i * 4] < 128;
        if (isBlack && !visited[i]) {
            let pixelCount = 0;
            const stack = [i];
            visited[i] = 1;
            labels[i] = currentLabel;

            while (stack.length > 0) {
                const idx = stack.pop()!;
                pixelCount++;
                labels[idx] = currentLabel;

                const x = idx % w;
                const y = Math.floor(idx / w);

                const neighbors = [
                    { x: x + 1, y: y }, { x: x - 1, y: y },
                    { x: x, y: y + 1 }, { x: x, y: y - 1 }
                ];

                for (const n of neighbors) {
                    if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
                        const nIdx = n.y * w + n.x;
                        if (!visited[nIdx] && data[nIdx * 4] < 128) {
                            visited[nIdx] = 1;
                            stack.push(nIdx);
                        }
                    }
                }
            }

            labelSizes[currentLabel] = pixelCount;
            currentLabel++;
        }
    }

    let largestLabel = 0;
    let maxSize = 0;
    for (const [lbl, size] of Object.entries(labelSizes)) {
        if (size > maxSize) {
            maxSize = size;
            largestLabel = Number(lbl);
        }
    }

    for (let i = 0; i < w * h; i++) {
        if (labels[i] !== largestLabel) {
            data[i * 4] = 255;
            data[i * 4 + 1] = 255;
            data[i * 4 + 2] = 255;
        } else {
            data[i * 4] = 0;
            data[i * 4 + 1] = 0;
            data[i * 4 + 2] = 0;
        }
    }

    return imgData;
}

// --- AUTO CENTERING ---
export function centerContent(imgData: ImageData): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let hasBlack = false;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (data[idx] < 128) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasBlack = true;
            }
        }
    }

    if (!hasBlack) return imgData;

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;

    const targetX = w / 2;
    const targetY = h / 2;

    const shiftX = Math.round(targetX - centerX);
    const shiftY = Math.round(targetY - centerY);

    if (shiftX === 0 && shiftY === 0) return imgData;

    const newOutput = new ImageData(w, h);
    for (let i = 0; i < newOutput.data.length; i += 4) {
        newOutput.data[i] = 255;
        newOutput.data[i + 1] = 255;
        newOutput.data[i + 2] = 255;
        newOutput.data[i + 3] = 255;
    }

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const srcIdx = (y * w + x) * 4;
            if (data[srcIdx] < 128) {
                const destX = x + shiftX;
                const destY = y + shiftY;

                if (destX >= 0 && destX < w && destY >= 0 && destY < h) {
                    const destIdx = (destY * w + destX) * 4;
                    newOutput.data[destIdx] = 0;
                    newOutput.data[destIdx + 1] = 0;
                    newOutput.data[destIdx + 2] = 0;
                }
            }
        }
    }

    return newOutput;
}

// --- HOLE FILLING (Solidify) ---
// Converts a hollow contour or edge map into a solid silhouette
// Assumes White Background, Black Object
export function fillHoles(imgData: ImageData): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    // We will flood fill from the borders to identify the "True Background".
    // 1. Create a mask for visited pixels
    const visited = new Uint8Array(w * h); // 0 = unvisited, 1 = background
    const stack: number[] = [];

    // 2. Seed the stack with border pixels
    // Top & Bottom rows
    for (let x = 0; x < w; x++) {
        stack.push(x);                  // Top row (y=0)
        stack.push((h - 1) * w + x);    // Bottom row
    }
    // Left & Right columns
    for (let y = 1; y < h - 1; y++) {
        stack.push(y * w);              // Left col
        stack.push(y * w + (w - 1));    // Right col
    }

    // 3. Flood Fill Background (White-ish pixels)
    // We treat anything > 128 as potential background to walk through
    // But since we already thresholded, it should be 255.
    // However, the contour might be Black (0).
    // We walk on White pixels (255) to mark the outside.

    while (stack.length > 0) {
        const idx = stack.pop()!;
        if (visited[idx]) continue;

        // If it's a Black pixel (Edge/Object), we stop. It's a boundary.
        if (data[idx * 4] < 128) continue;

        visited[idx] = 1; // Mark as True Background

        const x = idx % w;
        const y = Math.floor(idx / w);

        // Neighbors
        if (x > 0) stack.push(idx - 1);
        if (x < w - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - w);
        if (y < h - 1) stack.push(idx + w);
    }

    // 4. Final Pass: 
    // If Visited (Background) -> Make White
    // If Not Visited (Inside the boundary) -> Make Black (Fill)
    for (let i = 0; i < w * h; i++) {
        if (visited[i]) {
            data[i * 4] = 255;
            data[i * 4 + 1] = 255;
            data[i * 4 + 2] = 255;
        } else {
            data[i * 4] = 0;
            data[i * 4 + 1] = 0;
            data[i * 4 + 2] = 0;
        }
    }

    return imgData;
}
