// Frames are transparent overlays on a shared 1080 × 1440 artboard.
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1440;
export const FRAMES = {
    insta: { src: 'images/photo/frame-insta.png' },
    x: { src: 'images/photo/frame-x.png' },
    original: { src: 'images/photo/frame-original.svg' },
    none: { src: null }
};
export const POSES = {
    pose1: 'images/photo/pose-1.svg',
    pose2: 'images/photo/pose-2.svg'
};
export const POSE_AREA = { x: 690, y: 855, width: 300, height: 360 };
// Inset the artwork 5% on each side; corners appear as 20px at a 360px preview.
export const FRAME_CARD = { x: 54, y: 72, width: 972, height: 1296, radius: 60 };
const frameLayers = new WeakMap();

function traceCard(ctx) {
    const { x, y, width, height, radius } = FRAME_CARD;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
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
        image.src = src;
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
    if (frameKey !== 'none') ctx.drawImage(frameLayer(assets[frameKey]), 0, 0);
    if (poseKey !== 'none') {
        const { x, y, width, height } = POSE_AREA;
        ctx.drawImage(assets[poseKey], x, y, width, height);
    }
}
