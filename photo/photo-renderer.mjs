// Frames are transparent overlays on a shared 1080 × 1440 artboard.
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1440;
export const FRAMES = {
    insta: { src: 'images/frame-insta.png' },
    x: { src: 'images/frame-x.png' },
    original: { src: 'images/frame-original.png' },
    none: { src: null }
};
export const POSES = {
    pose1: 'images/pose-1.png',
    pose2: 'images/pose-2.png'
};
// Pose PNGs include their placement on the full photo artboard.
export const POSE_AREA = { x: 0, y: 0, width: PHOTO_WIDTH, height: PHOTO_HEIGHT };
// Inset the artwork 5% on each side; corners appear as 20px at a 360px preview.
export const FRAME_CARD = { x: 54, y: 72, width: 972, height: 1296, radius: 60 };
// A 9px outline appears as 3px at a 360px preview; it follows the PNG's alpha.
export const ORIGINAL_FRAME_EDGE = {
    width: 9, shadowColor: 'rgba(20, 35, 46, 0.22)', shadowBlur: 15, shadowOffsetY: 6
};
const frameLayers = new WeakMap();
const originalFrameLayers = new WeakMap();
// Blur a small copy instead of reading full-resolution pixels on every frame.
// Three box passes give a soft blur without relying on Canvas filter support.
const BLUR_WIDTH = 180;
const BLUR_HEIGHT = 240;
const BLUR_RADIUS = 3;
const blurBuffers = new WeakMap();

function traceCard(ctx) {
    const { x, y, width, height, radius } = FRAME_CARD;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function blurPass(source, target, horizontal) {
    const length = horizontal ? BLUR_WIDTH : BLUR_HEIGHT;
    const lines = horizontal ? BLUR_HEIGHT : BLUR_WIDTH;
    const stride = horizontal ? 4 : BLUR_WIDTH * 4;
    const lineStride = horizontal ? BLUR_WIDTH * 4 : 4;
    const samples = BLUR_RADIUS * 2 + 1;
    for (let line = 0; line < lines; line++) {
        const base = line * lineStride;
        let red = 0, green = 0, blue = 0;
        for (let offset = -BLUR_RADIUS; offset <= BLUR_RADIUS; offset++) {
            const index = base + Math.max(0, Math.min(length - 1, offset)) * stride;
            red += source[index]; green += source[index + 1]; blue += source[index + 2];
        }
        for (let position = 0; position < length; position++) {
            const index = base + position * stride;
            target[index] = red / samples;
            target[index + 1] = green / samples;
            target[index + 2] = blue / samples;
            target[index + 3] = 255;
            // Repeat edge pixels so the outside of the photograph never fades to black.
            const add = base + Math.min(length - 1, position + BLUR_RADIUS + 1) * stride;
            const remove = base + Math.max(0, position - BLUR_RADIUS) * stride;
            red += source[add] - source[remove];
            green += source[add + 1] - source[remove + 1];
            blue += source[add + 2] - source[remove + 2];
        }
    }
}

function blurOutsideCard(ctx) {
    let buffer = blurBuffers.get(ctx);
    if (!buffer) {
        const canvas = document.createElement('canvas');
        canvas.width = BLUR_WIDTH;
        canvas.height = BLUR_HEIGHT;
        buffer = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), scratch: new Uint8ClampedArray(BLUR_WIDTH * BLUR_HEIGHT * 4) };
        blurBuffers.set(ctx, buffer);
    }
    buffer.ctx.drawImage(ctx.canvas, 0, 0, BLUR_WIDTH, BLUR_HEIGHT);
    const pixels = buffer.ctx.getImageData(0, 0, BLUR_WIDTH, BLUR_HEIGHT);
    for (let pass = 0; pass < 3; pass++) {
        blurPass(pixels.data, buffer.scratch, true);
        blurPass(buffer.scratch, pixels.data, false);
    }
    buffer.ctx.putImageData(pixels, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    traceCard(ctx);
    ctx.clip('evenodd');
    ctx.drawImage(buffer.canvas, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.restore();
}

function frameLayer(image) {
    if (frameLayers.has(image)) return frameLayers.get(image);
    const card = document.createElement('canvas');
    card.width = PHOTO_WIDTH;
    card.height = PHOTO_HEIGHT;
    const cardCtx = card.getContext('2d');
    cardCtx.beginPath();
    traceCard(cardCtx);
    cardCtx.clip();
    const { x, y, width, height } = FRAME_CARD;
    cardCtx.drawImage(image, x, y, width, height);

    const layer = document.createElement('canvas');
    layer.width = PHOTO_WIDTH;
    layer.height = PHOTO_HEIGHT;
    const layerCtx = layer.getContext('2d');
    // Cast a shadow outside the card only. Transparent artwork stays transparent,
    // and artwork without a solid border does not acquire an invented rectangle.
    layerCtx.save();
    layerCtx.beginPath();
    layerCtx.rect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    traceCard(layerCtx);
    layerCtx.clip('evenodd');
    layerCtx.shadowColor = 'rgba(20, 35, 46, 0.19)';
    layerCtx.shadowBlur = 30;
    layerCtx.shadowOffsetY = 12;
    layerCtx.drawImage(card, 0, 0);
    layerCtx.restore();
    layerCtx.drawImage(card, 0, 0);
    frameLayers.set(image, layer);
    return layer;
}

function originalFrameLayer(image) {
    if (originalFrameLayers.has(image)) return originalFrameLayers.get(image);
    const outline = document.createElement('canvas');
    outline.width = PHOTO_WIDTH;
    outline.height = PHOTO_HEIGHT;
    const outlineCtx = outline.getContext('2d');
    outlineCtx.drawImage(image, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    // Expand the artwork's silhouette, including edges facing the photo window.
    // Build this once per image, without Canvas filter or a rectangular backing.
    for (let step = 0; step < 32; step++) {
        const angle = step * Math.PI * 2 / 32;
        outlineCtx.drawImage(image,
            Math.cos(angle) * ORIGINAL_FRAME_EDGE.width,
            Math.sin(angle) * ORIGINAL_FRAME_EDGE.width, PHOTO_WIDTH, PHOTO_HEIGHT);
    }
    outlineCtx.globalCompositeOperation = 'source-in';
    outlineCtx.fillStyle = '#fff';
    outlineCtx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);

    const layer = document.createElement('canvas');
    layer.width = PHOTO_WIDTH;
    layer.height = PHOTO_HEIGHT;
    const layerCtx = layer.getContext('2d');
    layerCtx.save();
    layerCtx.shadowColor = ORIGINAL_FRAME_EDGE.shadowColor;
    layerCtx.shadowBlur = ORIGINAL_FRAME_EDGE.shadowBlur;
    layerCtx.shadowOffsetY = ORIGINAL_FRAME_EDGE.shadowOffsetY;
    layerCtx.drawImage(outline, 0, 0);
    layerCtx.restore();
    layerCtx.drawImage(image, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    originalFrameLayers.set(image, layer);
    return layer;
}

export function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = targetWidth / scale;
    const height = targetHeight / scale;
    return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height };
}

export async function loadPhotoAssets() {
    const assets = {};
    await Promise.all([...Object.entries(FRAMES).filter(([, frame]) => frame.src).map(([key, frame]) => [key, frame.src]), ...Object.entries(POSES)].map(async ([key, src]) => {
        const image = new Image();
        image.src = new URL(src, import.meta.url);
        await image.decode();
        assets[key] = image;
    }));
    return assets;
}

// Preview and exported PNG use this same canvas, including crop and selfie mirroring.
export function renderPhoto(ctx, video, assets, frameKey, poseKey, mirror) {
    // The camera crop stays fixed when frames change, including OFF.
    const crop = coverCrop(video.videoWidth, video.videoHeight, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.clearRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.save();
    ctx.translate(mirror ? PHOTO_WIDTH : 0, 0);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
    ctx.restore();
    if (poseKey !== 'none') {
        const { x, y, width, height } = POSE_AREA;
        ctx.drawImage(assets[poseKey], x, y, width, height);
    }
    // Only the social-media cards blur the camera and character outside their window.
    if (frameKey !== 'none' && frameKey !== 'original') blurOutsideCard(ctx);
    if (frameKey === 'original') ctx.drawImage(originalFrameLayer(assets[frameKey]), 0, 0);
    else if (frameKey !== 'none') ctx.drawImage(frameLayer(assets[frameKey]), 0, 0);
}
