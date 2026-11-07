export interface TaskLayoutOptions {
  viewportWidth: number;
  viewportHeight: number;
  zoom?: number;
  scrollX?: number;
  scrollY?: number;
  statementText: string;
  obstacles?: {
    leftCardRight?: number;
    leftCardBottom?: number;
    topBarBottom?: number;
    rightIconsLeft?: number;
    bubbleTop?: number;
    railWidth?: number;
  };
}

export interface TaskLayoutResult {
  text: string;
  fontSize: number;
  sceneX: number;
  sceneY: number;
  viewportX: number;
  viewportY: number;
  estimatedWidth: number;
  estimatedHeight: number;
  linesCount: number;
}

export function wrapTaskText(text: string, maxLineChars: number): string {
  const paragraphs = text.split('\n');
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      resultLines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxLineChars) {
        current += ' ' + word;
      } else {
        resultLines.push(current);
        current = word;
      }
    }
    if (current) resultLines.push(current);
  }

  return resultLines.join('\n');
}

export function computeTaskFontSize(textLength: number, isMobile: boolean): number {
  if (isMobile) {
    if (textLength > 100) return 14;
    if (textLength > 50) return 16;
    return 18;
  }
  if (textLength > 120) return 15;
  if (textLength > 70) return 17;
  if (textLength > 40) return 19;
  return 22;
}

export function computeTaskLayout({
  viewportWidth,
  viewportHeight,
  zoom = 1,
  scrollX = 0,
  scrollY = 0,
  statementText,
  obstacles = {},
}: TaskLayoutOptions): TaskLayoutResult {
  const isMobile = viewportWidth <= 700;
  const rawText = statementText.trim();
  const fontSize = computeTaskFontSize(rawText.length, isMobile);

  // Character width estimate for Excalidraw Virgil font
  const charWidth = fontSize * 0.54;
  const lineHeight = fontSize * 1.35;

  let maxBoxWidth: number;
  let viewportX: number;
  let viewportY: number;

  const clearance = 24;
  const topBarBottom = obstacles.topBarBottom ?? (isMobile ? 52 : 56);
  const leftCardRight = obstacles.leftCardRight ?? (isMobile ? 0 : 380);
  // Phones reserve two 44px tool rows, then the compact HUD card below them.
  const leftCardBottom = obstacles.leftCardBottom ?? (isMobile ? 340 : 220);
  const rightIconsLeft = obstacles.rightIconsLeft ?? (viewportWidth - 100);
  const railWidth = obstacles.railWidth ?? (isMobile ? 0 : 72);

  if (isMobile) {
    // Mobile: under top bar and compact card across viewport width with 16px margins
    viewportX = 16;
    maxBoxWidth = Math.max(240, viewportWidth - 32);
    viewportY = Math.max(leftCardBottom + clearance, topBarBottom + clearance, 116);
  } else {
    // Desktop / Tablet: wrap text to ~60% of viewport
    maxBoxWidth = Math.round(viewportWidth * 0.58);
    const centerX = Math.round(viewportWidth / 2);
    const targetX = Math.round(centerX - maxBoxWidth / 2);

    // If target left edge collides with top-left card:
    if (targetX < leftCardRight + clearance) {
      const candidateX = leftCardRight + clearance;
      // If there is enough room to the right of top-left card before right icons:
      if (candidateX + maxBoxWidth <= rightIconsLeft - clearance) {
        viewportX = candidateX;
        viewportY = topBarBottom + clearance;
      } else {
        // Otherwise place below top-left card, clear of left rail
        viewportY = Math.max(leftCardBottom + clearance, topBarBottom + clearance);
        viewportX = Math.max(railWidth + clearance, targetX);
      }
    } else {
      // Centered with adequate clearance from left card
      viewportX = targetX;
      viewportY = topBarBottom + clearance;
    }
  }

  const maxCharsPerLine = Math.max(24, Math.floor(maxBoxWidth / charWidth));
  const wrappedText = wrapTaskText(rawText, maxCharsPerLine);
  const lines = wrappedText.split('\n');
  const linesCount = lines.length;

  const maxLineLength = Math.max(...lines.map(l => l.length));
  const estimatedWidth = Math.round(maxLineLength * charWidth) + 16;
  const estimatedHeight = Math.round(linesCount * lineHeight) + 12;

  // Verify within viewport boundaries: if it overflows bottom or right, adjust
  if (viewportX + estimatedWidth > viewportWidth - 16) {
    viewportX = Math.max(16, viewportWidth - estimatedWidth - 16);
  }
  if (viewportY + estimatedHeight > viewportHeight - 80) {
    viewportY = Math.max(topBarBottom + clearance, viewportHeight - estimatedHeight - 80);
  }

  // Convert to scene coordinates
  const safeZoom = zoom > 0 ? zoom : 1;
  const sceneX = Math.round(viewportX / safeZoom - scrollX);
  const sceneY = Math.round(viewportY / safeZoom - scrollY);

  return {
    text: wrappedText,
    fontSize,
    sceneX,
    sceneY,
    viewportX,
    viewportY,
    estimatedWidth,
    estimatedHeight,
    linesCount,
  };
}

export function isTaskVisibleInViewport(layout: TaskLayoutResult, viewportWidth: number, viewportHeight: number, obstacles: { leftCardRight?: number; leftCardBottom?: number; topBarBottom?: number } = {}): { visible: boolean; overlapsHUD: boolean } {
  const right = layout.viewportX + layout.estimatedWidth;
  const bottom = layout.viewportY + layout.estimatedHeight;
  const inBounds = layout.viewportX >= 0 && layout.viewportY >= 0 && right <= viewportWidth && bottom <= viewportHeight;
  const topBarBottom = obstacles.topBarBottom ?? 52;
  const leftCardRight = obstacles.leftCardRight ?? 0;
  const leftCardBottom = obstacles.leftCardBottom ?? 0;
  const overlapsTopBar = layout.viewportY < topBarBottom;
  const overlapsLeftCard = layout.viewportX < leftCardRight && layout.viewportY < leftCardBottom;
  const overlapsHUD = overlapsTopBar || overlapsLeftCard;
  return { visible: inBounds && !overlapsHUD, overlapsHUD };
}
