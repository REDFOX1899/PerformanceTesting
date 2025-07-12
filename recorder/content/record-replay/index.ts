import { ObjectHighlighter } from './object-highlighter';
import { takeScreenshot } from './screenshots';

// Poor man exports to global scope
const GLOBAL_EXPORT = window as any;
GLOBAL_EXPORT.takeScreenshot = takeScreenshot;
GLOBAL_EXPORT.objectHighlighter = new ObjectHighlighter();
