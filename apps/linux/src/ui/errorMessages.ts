/**
 * Single source of user-facing error messages.
 *
 * RULE: the UI must never render raw technical text (command output, paths,
 * engine names, JSON/plugin errors). Every branch below returns plain words
 * a non-technical user understands, in English; components pair them with
 * Bangla where they render bilingual UI. Unknown errors fall through to a
 * generic friendly message — never the raw string.
 */
export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = raw.toLowerCase();

  // Network / offline — highest priority
  if (lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('internet') || lower.includes('econn') || lower.includes('timed out') || lower.includes('timeout') || lower.includes('dns') || lower.includes('enotfound') || lower.includes('err_internet_disconnected')) {
    if (lower.includes('timeout') || lower.includes('timed out')) return 'Request timed out — please check your internet connection and try again.';
    return 'No internet connection. Please check your network and try again.';
  }
  if (lower.includes('invoke') || lower.includes('tauri') || lower.includes('undefined')) {
    return 'The downloader is unavailable in this environment. Please try again or reopen the app.';
  }
  if (lower.includes('invalid url') || lower.includes('only http') || lower.includes('url is required')) {
    return 'Please enter a valid http or https link.';
  }
  if (lower.includes('not a bot') || lower.includes('bot check') || lower.includes('temporarily blocking automated') || lower.includes('429') || lower.includes('too many requests') || lower.includes('rate-limit') || lower.includes('rate limited')) {
    return 'YouTube is temporarily blocking requests from this network (bot check). Please wait a few minutes and try again.';
  }
  if (lower.includes('requires login') || lower.includes('is private or requires login')) {
    return 'This video is private or requires login and cannot be analyzed.';
  }
  if (lower.includes('unsupported url') || lower.includes('unsupported') || lower.includes('private') || lower.includes('unavailable') || lower.includes('no video') || lower.includes('video unavailable') || lower.includes('not available') || lower.includes('unable to retrieve') || lower.includes('unable to retrieve media details') || lower.includes('unable to retrieve playlist details')) {
    return 'This link is private, unsupported, or unavailable. Please try a public video link.';
  }
  if (lower.includes('invalid output directory') || lower.includes('unable to create output folder') || lower.includes('unable to create temporary download workspace')) {
    return 'Invalid output folder. Please pick a valid folder (e.g., Downloads/KWL Video Downloader) via Browse and try again.';
  }
  if (lower.includes('media file was not found') || lower.includes('media file is outside') || lower.includes('media file path is required') || lower.includes('downloaded output file was not found') || lower.includes('downloaded media failed validation') || lower.includes('downloaded media has no valid')) {
    return 'Media file not found, outside allowed folders, or failed validation. Please check the path and try again.';
  }
  if (lower.includes('resolution is required') || lower.includes('quality is required') || lower.includes('format is required') || lower.includes('fps must be greater')) {
    return 'Please complete the required selections (Type, Format, Quality/Dimension) before adding to queue.';
  }
  // Updater service errors (endpoint, release feed, signatures, platform set)
  if (lower.includes('could not fetch a valid release') || lower.includes('fallback platform') || lower.includes('platforms') && lower.includes('object') || lower.includes('release json') || lower.includes('release feed')) {
    return 'Update information is unavailable right now. Please try again later.';
  }
  if (lower.includes('signature') || lower.includes('verify') || lower.includes('verification')) {
    return 'Update verification failed — the release could not be confirmed. Please try again later.';
  }
  if (lower.includes('yt-dlp') || lower.includes('runtime is not available') || lower.includes('ffprobe runtime is not available') || lower.includes('ffmpeg runtime is not available')) {
    return 'The downloader is getting ready. Please wait a moment and try again.';
  }
  if (lower.includes('download failed') || lower.includes('download process could not')) {
    return 'The download could not complete. Please check the link and try again.';
  }
  if (lower.includes('unable to')) {
    return 'The analysis could not complete. Please check the link and try again.';
  }

  if (fallback && fallback.trim()) return fallback.trim();
  return 'Something went wrong. Please try again.';
}
