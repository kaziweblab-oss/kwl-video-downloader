import { createContext, useContext, ReactNode } from 'react';
import { useSettings } from '../store/settingsStore';

type Language = 'en' | 'bn';

type Translations = {
  brand: string;
  urlTitle: string;
  analyze: string;
  clear: string;
  mediaType: string;
  video: string;
  audio: string;
  format: string;
  resolution: string;
  outputFolder: string;
  browse: string;
  download: string;
  status: string;
  retry: string;
  cancel: string;
  openFolder: string;
  ready: string;
  analyzing: string;
  queued: string;
  downloading: string;
  processing: string;
  validating: string;
  completed: string;
  failed: string;
  cancelled: string;
  audioQuality: string;
  source: string;
  author: string;
  duration: string;
  errorUrl: string;
  errorRequest: string;
  hiddenResolutionHelper: string;
  items: string;
  localStorage: string;
  openFile: string;
  showInFolder: string;
  emptyHistory: string;
  downloaded: string;
  speed: string;
  mediaFallback: string;
  downloadedMedia: string;
  recentDownloads: string;
  history: string;
  add: string;
queueLabel: string;
    downloadQueue: string;
    queueEmpty: string;
    remove: string;
    delete: string;
    startDownload: string;
    pending: string;
    duplicateError: string;
    analyzedMedia: string;
    emptyAnalysis: string;
    mark: string;
    pause: string;
    resume: string;
    paused: string;
    quality: string;
    mediaPreview: string;
    previewEmpty: string;
    alreadyAnalyzed: string;
    refresh: string;
    converting: string;
    selectMediaFirst: string;
    selectMediaHint: string;
    selectTypeFirst: string;
    selectFormatFirst: string;
    selectQualityFirst: string;
    selectResolutionFirst: string;
    analyzedMediaSelected: string;
    removeSelection: string;
    addIncomplete: string;
    quickSelect: string;
    exactResolution: string;
    autoDetectHint: string;
    secureValidationHint: string;
    selectMediaTitle: string;
    selectMediaDesc: string;
    dimensions: string;
    qcifNote: string;
    back: string;
    goToQueue: string;
    addToQueue: string;
    next: string;
    defaultOutputFolder: string;
    theme: string;
    darkTheme: string;
    maxConcurrentLabel: string;
    maxConcurrentHint: string;
    concurrentDownloadsTitle: string;
    concurrentDownloadsDesc: string;
    sequential: string;
    defaultConcurrent: string;
    recommended: string;
    maxConcurrent: string;
    currentConcurrent: string;
    done: string;
    afterDownload: string;
    doNothing: string;
    openFolderAction: string;
    playMedia: string;
    checkUpdates: string;
    checkNow: string;
    navDownloader: string;
    navQueue: string;
    navHistory: string;
    navSettings: string;
    navAbout: string;
    size: string;
    estimatedSize: string;
    unknownSize: string;
    total: string;
    videoLabel: string;
    audioLabel: string;
    addedToQueue: string;
    addedWithDuplicate: string;
    queuedSize: string;
    estimatedQueuedSize: string;
    unknownQueuedSize: string;
    selectMediaFirstShort: string;
    pauseAllNoActive: string;
    resumeAllNoPaused: string;
    pausedCount: string;
    resumedCount: string;
    pauseFailed: string;
    resumeFailed: string;
    welcomeBack: string;
    reportButton: string;
    reportTitle: string;
    reportType: string;
    reportError: string;
    reportSuggestion: string;
    reportFeedback: string;
    reportMessage: string;
    reportMessagePlaceholder: string;
    reportAttachInfo: string;
    reportEmail: string;
    reportEmailPlaceholder: string;
    reportSend: string;
    reportSending: string;
    reportSuccess: string;
    reportFailed: string;
    aboutDescription: string;
    aboutPlatform: string;
    aboutVersion: string;
    aboutClosedSource: string;
    aboutPrivacyPolicy: string;
    aboutProductOf: string;
    aboutPrivacyTitle: string;
    aboutPrivacyContent: string;
    aboutAllRightsReserved: string;
    gitHub: string;
    reportIssue: string;
    privacyPolicy: string;
};

const translations: Record<Language, Translations> = {
  en: {
    brand: 'KWL Video Downloader',
    urlTitle: 'Paste video or media URL',
    analyze: 'Analyze',
    clear: 'Clear',
    mediaType: 'Select Media Type',
    video: 'Video',
    audio: 'Audio',
    format: 'Format',
    resolution: 'Resolution / Quality',
    outputFolder: 'Output folder',
    browse: 'Browse',
    download: 'Download',
    status: 'Status',
    retry: 'Retry',
    cancel: 'Cancel',
    openFolder: 'Open folder',
    ready: 'Ready',
    analyzing: 'Analyzing…',
    queued: 'Queued',
    downloading: 'Downloading',
    processing: 'Processing',
    validating: 'Validating',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    audioQuality: 'Audio quality',
    source: 'Source',
    author: 'Author',
    duration: 'Duration',
    errorUrl: 'Please enter a valid http/https URL.',
    errorRequest: 'Download request failed.',
    hiddenResolutionHelper: 'Resolution controls are hidden for audio downloads.',
    items: 'items',
    localStorage: 'Local storage',
    openFile: 'Open file',
    showInFolder: 'Show in folder',
    emptyHistory: 'Completed downloads will appear here.',
    downloaded: 'Downloaded',
    speed: 'Speed',
    mediaFallback: 'Media',
    downloadedMedia: 'Downloaded media',
    recentDownloads: 'Recent downloads',
    history: 'History',
    add: 'Add',
    queueLabel: 'Queue',
    downloadQueue: 'Download queue',
    queueEmpty: 'Added downloads will appear here.',
    remove: 'Remove',
    delete: 'Delete',
    startDownload: 'Start download',
    pending: 'Pending',
    duplicateError: 'This item is already in the download queue.',
    analyzedMedia: 'Analyzed media',
    emptyAnalysis: 'Analyze a link to build the media list.',
    mark: 'Mark',
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused',
    quality: 'Quality',
    mediaPreview: 'Media preview',
    previewEmpty: 'Analyze a link to preview media here.',
    alreadyAnalyzed: 'Already analyzed — showing saved media',
    refresh: 'Refresh',
    converting: 'Converting',
    selectMediaFirst: 'Please select an analyzed video first.',
    selectMediaHint: 'Select an analyzed media from the list to configure the download.',
    selectTypeFirst: 'Select the analyzed media first.',
    selectFormatFirst: 'Select Video or Audio first.',
    selectQualityFirst: 'Select a format first.',
    selectResolutionFirst: 'Select a quality first.',
    analyzedMediaSelected: 'Analyzed media selected',
    removeSelection: 'Remove selection',
    addIncomplete: 'Complete the required selections first.',
    quickSelect: 'Quick Select',
    exactResolution: 'Exact Resolution (Source)',
    autoDetectHint: 'Auto-detect enabled — paste any single video or playlist link, app will detect the type and handle it automatically. No need to select link type.',
    secureValidationHint: 'Secure validation before media analysis and download.',
    selectMediaTitle: 'Select Media',
    selectMediaDesc: 'Select one or more items from the Analyzed media list above. Card click and checkbox use the same selection.',
    dimensions: 'Dimensions',
    qcifNote: '176×144 QCIF always available — exact dimensions are enforced in download',
    back: '← Back',
    goToQueue: 'Go to Queue →',
    addToQueue: 'Add to Queue +',
    next: 'Next →',
    defaultOutputFolder: 'Default Output Folder',
    theme: 'Theme',
    darkTheme: 'Dark (system default)',
    maxConcurrentLabel: 'How many videos download at same time',
    maxConcurrentHint: 'Highest 5 — like professional downloaders (default 2). Tap to change.',
    concurrentDownloadsTitle: 'Concurrent Downloads',
    concurrentDownloadsDesc: 'How many videos download at same time · Max 5',
    sequential: 'Sequential',
    defaultConcurrent: 'Default',
    recommended: 'Recommended',
    maxConcurrent: 'Max',
    currentConcurrent: 'Current: {count} at once',
    done: 'Done',
    afterDownload: 'After Download',
    doNothing: 'Do nothing',
    openFolderAction: 'Open folder',
    playMedia: 'Play media',
    checkUpdates: 'Check for Updates',
    checkNow: 'Check Now',
    navDownloader: 'Downloader',
    navQueue: 'Queue',
    navHistory: 'History',
    navSettings: 'Settings',
    navAbout: 'About',
    size: 'Size',
    estimatedSize: 'Estimated size',
    unknownSize: 'Unknown',
    total: 'Total',
    videoLabel: 'Video',
    audioLabel: 'Audio',
    addedToQueue: 'Added {count} video(s) to queue',
    addedWithDuplicate: 'Added {count} item(s) — {msg}',
    queuedSize: 'Queued • Size: {size}',
    estimatedQueuedSize: 'Queued • Estimated size: ~{size}',
    unknownQueuedSize: 'Queued • Size: Unknown',
    selectMediaFirstShort: 'Please select an analyzed video first.',
    pauseAllNoActive: 'No active downloads to pause',
    resumeAllNoPaused: 'No paused downloads to resume',
    pausedCount: 'Paused {count} download(s)',
    resumedCount: 'Resumed {count} download(s)',
    pauseFailed: 'Pause failed',
    resumeFailed: 'Resume failed',
    welcomeBack: 'Welcome back',
    reportButton: '📧 Report Issue / Suggestion',
    reportTitle: 'Report an Issue / Suggestion',
    reportType: 'Report Type',
    reportError: 'Error',
    reportSuggestion: 'Suggestion',
    reportFeedback: 'Feedback',
    reportMessage: 'Your message',
    reportMessagePlaceholder: 'Describe the problem or your suggestion in detail…',
    reportAttachInfo: 'Attach diagnostic info (app version, device, settings)',
    reportEmail: 'Email (optional)',
    reportEmailPlaceholder: 'you@example.com',
    reportSend: 'Send Report',
    reportSending: 'Sending…',
    reportSuccess: 'Thank you for your report! 🙏',
    reportFailed: 'Failed to send report. Please try again.',
    aboutDescription: 'A modern video downloader built with Tauri 2, React, TypeScript, and Rust. Supports multi-format downloads, real-time progress, pause/resume, and history management.',
    aboutPlatform: 'Windows x64',
    aboutVersion: 'Version',
    aboutClosedSource: 'Closed source — All rights reserved. Source code is not public.',
    aboutPrivacyPolicy: 'Privacy Policy',
    aboutProductOf: 'A Product of Kazi Web Lab (KWL)',
    aboutPrivacyTitle: 'Privacy Policy',
    aboutPrivacyContent: 'KWL Video Downloader is closed source. Your downloads are stored locally on your device. We do not collect personal data, browsing history, or download content. Network is used only to fetch video info (yt-dlp) and to check for app updates (GitHub Releases). No analytics or tracking. You can use the app offline for History and Settings; online is required only for analyzing/downloading new links.',
    aboutAllRightsReserved: '© 2026 KWL. All rights reserved.',
    gitHub: 'GitHub',
    reportIssue: 'Report Issue',
    privacyPolicy: 'Privacy Policy',
  },
  bn: {
    brand: 'KWL ভিডিও ডাউনলোডার',
    urlTitle: 'ভিডিও বা মিডিয়া লিঙ্ক পেস্ট করুন',
    analyze: 'বিশ্লেষণ',
    clear: 'মুছুন',
    mediaType: 'মিডিয়া টাইপ নির্বাচন',
    video: 'ভিডিও',
    audio: 'অডিও',
    format: 'ফরম্যাট',
    resolution: 'রেজোলিউশন / কোয়ালিটি',
    outputFolder: 'আউটপুট ফোল্ডার',
    browse: 'ব্রাউজ',
    download: 'ডাউনলোড',
    status: 'স্ট্যাটাস',
    retry: 'রিট্রাই',
    cancel: 'বাতিল',
    openFolder: 'ফোল্ডার খুলুন',
    ready: 'প্রস্তুত',
    analyzing: 'বিশ্লেষণ করা হচ্ছে…',
    queued: 'সারিবদ্ধ',
    downloading: 'ডাউনলোড হচ্ছে',
    processing: 'প্রসেস হচ্ছে',
    validating: 'ভ্যালিডেশন চলছে',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    items: 'টি আইটেম',
    localStorage: 'লোকাল স্টোরেজ',
    openFile: 'ফাইল খুলুন',
    showInFolder: 'ফোল্ডারে দেখুন',
    emptyHistory: 'সম্পন্ন ডাউনলোড এখানে দেখা যাবে।',
    failed: 'ব্যর্থ',
    audioQuality: 'অডিও কোয়ালিটি',
    source: 'সোর্স',
    author: 'লেখক',
    duration: 'সময়',
    errorUrl: 'একটি বৈধ http/https URL দিন।',
    errorRequest: 'ডাউনলোড অনুরোধ ব্যর্থ হয়েছে।',
    hiddenResolutionHelper: 'অডিও ডাউনলোডে রেজোলিউশন নিয়ন্ত্রণ লুকানো আছে।',
    downloaded: 'ডাউনলোড হয়েছে',
    speed: 'গতি',
    mediaFallback: 'মিডিয়া',
    downloadedMedia: 'ডাউনলোড করা মিডিয়া',
    recentDownloads: 'সাম্প্রতিক ডাউনলোড',
    history: 'ইতিহাস',
    add: 'যোগ করুন',
    queueLabel: 'কিউ',
    downloadQueue: 'ডাউনলোড কিউ',
    queueEmpty: 'যোগ করা ডাউনলোড এখানে দেখা যাবে।',
    remove: 'সরান',
    delete: 'মুছে ফেলুন',
    startDownload: 'ডাউনলোড শুরু',
    pending: 'অপেক্ষমাণ',
    duplicateError: 'এই আইটেমটি ইতিমধ্যে ডাউনলোড কিউতে আছে।',
    analyzedMedia: 'বিশ্লেষিত মিডিয়া',
    emptyAnalysis: 'লিঙ্ক বিশ্লেষণ করলে মিডিয়া তালিকা এখানে দেখা যাবে।',
    mark: 'নির্বাচন',
    pause: 'বিরতি',
    resume: 'পুনরায় শুরু',
    paused: 'বিরতিতে',
    quality: 'কোয়ালিটি',
    mediaPreview: 'মিডিয়া প্রিভিউ',
    previewEmpty: 'লিঙ্ক বিশ্লেষণ করলে প্রিভিউ এখানে দেখা যাবে।',
    alreadyAnalyzed: 'ইতিমধ্যে বিশ্লেষণ করা — সংরক্ষিত মিডিয়া দেখানো হচ্ছে',
    refresh: 'রিফ্রেশ',
    converting: 'কনভার্ট হচ্ছে',
    selectMediaFirst: 'অনুগ্রহ করে প্রথমে একটি বিশ্লেষিত ভিডিও নির্বাচন করুন।',
    selectMediaHint: 'ডাউনলোড কনফিগার করতে তালিকা থেকে একটি বিশ্লেষিত মিডিয়া নির্বাচন করুন।',
    selectTypeFirst: 'প্রথমে বিশ্লেষিত মিডিয়া নির্বাচন করুন।',
    selectFormatFirst: 'প্রথমে Video বা Audio নির্বাচন করুন।',
    selectQualityFirst: 'প্রথমে ফরম্যাট নির্বাচন করুন।',
    selectResolutionFirst: 'প্রথমে কোয়ালিটি নির্বাচন করুন।',
    analyzedMediaSelected: 'বিশ্লেষিত মিডিয়া নির্বাচন করা হয়েছে',
    removeSelection: 'নির্বাচন সরান',
    addIncomplete: 'প্রয়োজনীয় সব নির্বাচন সম্পন্ন করুন।',
    quickSelect: 'দ্রুত নির্বাচন',
    exactResolution: 'সঠিক রেজোলিউশন (সোর্স)',
    autoDetectHint: 'অটো-ডিটেক্ট সক্ষম — যেকোনো ভিডিও বা প্লেলিস্ট লিঙ্ক পেস্ট করুন, অ্যাপ স্বয়ংক্রিয়ভাবে ধরন চিহ্নিত করবে এবং হ্যান্ডেল করবে। লিঙ্ক টাইপ নির্বাচনের প্রয়োজন নেই।',
    secureValidationHint: 'মিডিয়া বিশ্লেষণ এবং ডাউনলোডের আগে সুরক্ষিত যাচাই।',
    selectMediaTitle: 'মিডিয়া নির্বাচন',
    selectMediaDesc: 'উপরোক্ত বিশ্লেষিত মিডিয়া তালিকা থেকে এক বা একাধিক আইটেম নির্বাচন করুন। কার্ড ক্লিক এবং চেকবক্স একই নির্বাচন ব্যবহার করে।',
    dimensions: 'আয়তন',
    qcifNote: '১৭৬×১৪৪ QCIF সর্বদা উপলব্ধ — সঠিক মাত্রা ডাউনলোডে প্রয়োগ করা হয়',
    back: '← পেছনে',
    goToQueue: 'কিউতে যান →',
    addToQueue: 'কিউতে যোগ করুন +',
    next: 'পরবর্তী →',
    defaultOutputFolder: 'ডিফল্ট আউটপুট ফোল্ডার',
    theme: 'থিম',
    darkTheme: 'ডার্ক (সিস্টেম ডিফল্ট)',
    maxConcurrentLabel: 'একসাথে কতগুলো ভিডিও ডাউনলোড হবে',
    maxConcurrentHint: 'সর্বোচ্চ ৫ — প্রোফেশনাল ডাউনলোডারের মত (ডিফল্ট ২)। পরিবর্তন করতে ট্যাপ করুন।',
    concurrentDownloadsTitle: 'একযোগে ডাউনলোড',
    concurrentDownloadsDesc: 'একসাথে কতগুলো ভিডিও ডাউনলোড হবে · সর্বোচ্চ ৫',
    sequential: 'ক্রমিক',
    defaultConcurrent: 'ডিফল্ট',
    recommended: 'সুপারিশ করা',
    maxConcurrent: 'সর্বোচ্চ',
    currentConcurrent: 'বর্তমান: {count}টি একসাথে',
    done: 'হয়েছে',
    afterDownload: 'ডাউনলোডের পর',
    doNothing: 'কিছু করবেন না',
    openFolderAction: 'ফোল্ডার খুলুন',
    playMedia: 'মিডিয়া চালান',
    checkUpdates: 'আপডেটের জন্য চেক করুন',
    checkNow: 'এখনই চেক করুন',
    navDownloader: 'ডাউনলোডার',
    navQueue: 'কিউ',
    navHistory: 'ইতিহাস',
    navSettings: 'সেটিংস',
    navAbout: 'পরিচিতি',
    size: 'সাইজ',
    estimatedSize: 'আনুমানিক সাইজ',
    unknownSize: 'অজানা',
    total: 'মোট',
    videoLabel: 'ভিডিও',
    audioLabel: 'অডিও',
    addedToQueue: '{count}টি ভিডিও কিউতে যোগ করা হয়েছে',
    addedWithDuplicate: '{count}টি আইটেম যোগ করা হয়েছে — {msg}',
    queuedSize: 'সারিবদ্ধ • সাইজ: {size}',
    estimatedQueuedSize: 'সারিবদ্ধ • আনুমানিক সাইজ: ~{size}',
    unknownQueuedSize: 'সারিবদ্ধ • সাইজ: অজানা',
    selectMediaFirstShort: 'অনুগ্রহ করে প্রথমে একটি বিশ্লেষিত ভিডিও নির্বাচন করুন।',
    pauseAllNoActive: 'বিরতি দেওয়ার মতো কোনো সক্রিয় ডাউনলোড নেই',
    resumeAllNoPaused: 'পুনরায় শুরু করার মতো কোনো বিরতিতে থাকা ডাউনলোড নেই',
    pausedCount: '{count}টি ডাউনলোড বিরতিতে রাখা হয়েছে',
    resumedCount: '{count}টি ডাউনলোড পুনরায় শুরু করা হয়েছে',
    pauseFailed: 'বিরতি ব্যর্থ হয়েছে',
    resumeFailed: 'পুনরায় শুরু ব্যর্থ হয়েছে',
    welcomeBack: 'স্বাগতম',
    reportButton: '📧 সমস্যা / পরামর্শ রিপোর্ট করুন',
    reportTitle: 'সমস্যা / পরামর্শ রিপোর্ট করুন',
    reportType: 'রিপোর্টের ধরন',
    reportError: 'ত্রুটি',
    reportSuggestion: 'পরামর্শ',
    reportFeedback: 'প্রতিক্রিয়া',
    reportMessage: 'আপনার বার্তা',
    reportMessagePlaceholder: 'সমস্যা বা আপনার পরামর্শ বিস্তারিত লিখুন…',
    reportAttachInfo: 'ডায়াগনস্টিক তথ্য সংযুক্ত করুন (অ্যাপ ভার্সন, ডিভাইস, সেটিংস)',
    reportEmail: 'ইমেইল (ঐচ্ছিক)',
    reportEmailPlaceholder: 'you@example.com',
    reportSend: 'রিপোর্ট পাঠান',
    reportSending: 'পাঠানো হচ্ছে…',
    reportSuccess: 'আপনার রিপোর্টের জন্য ধন্যবাদ! 🙏',
    reportFailed: 'রিপোর্ট পাঠানো ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
    aboutDescription: 'Tauri 2, React, TypeScript এবং Rust দিয়ে তৈরি একটি আধুনিক ভিডিও ডাউনলোডার। মাল্টি-ফরম্যাট ডাউনলোড, রিয়েল-টাইম প্রগ্রেস, বিরতি/পুনরায় শুরু এবং ইতিহাস ব্যবস্থাপনা সমর্থন করে।',
    aboutPlatform: 'Windows x64',
    aboutVersion: 'ভার্সন',
    aboutClosedSource: 'ক্লোজড সোর্স — সর্বস্বত্ব সংরক্ষিত। সোর্স কোড উন্মুক্ত নয়।',
    aboutPrivacyPolicy: 'গোপনীয়তা নীতি',
    aboutProductOf: 'Kazi Web Lab (KWL) এর একটি পণ্য',
    aboutPrivacyTitle: 'গোপনীয়তা নীতি',
    aboutPrivacyContent: 'KWL Video Downloader ক্লোজড সোর্স। আপনার ডাউনলোডগুলি আপনার ডিভাইসে স্থানীয়ভাবে সংরক্ষিত হয়। আমরা ব্যক্তিগত ডেটা, ব্রাউজিং ইতিহাস বা ডাউনলোড কন্টেন্ট সংগ্রহ করি না। নেটওয়ার্ক শুধুমাত্র ভিডিও তথ্য আনতে (yt-dlp) এবং অ্যাপ আপডেট চেক করতে (GitHub Releases) ব্যবহৃত হয়। কোনো অ্যানালিটিক্স বা ট্র্যাকিং নেই। History এবং Settings অফলাইনে ব্যবহার করা যায়; শুধুমাত্র নতুন লিঙ্ক বিশ্লেষণ/ডাউনলোড করতে অনলাইন প্রয়োজন।',
    aboutAllRightsReserved: '© ২০২৬ KWL। সর্বস্বত্ব সংরক্ষিত।',
    gitHub: 'গিটহাব',
    reportIssue: 'সমস্যা রিপোর্ট করুন',
    privacyPolicy: 'গোপনীয়তা নীতি',
  },
};

interface TranslationContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const TranslationContext = createContext<TranslationContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
});

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const { settings, setLanguage } = useSettings();
  const language = settings.language;
  const t = translations[language];
  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslations = (): Translations => {
  const { t } = useContext(TranslationContext);
  return t;
};

export const useLanguage = () => useContext(TranslationContext);