interface JQueryStatic {
    elementStatus: JQuery;
    elementProgressButton: JQuery;
    elementProgresBodyP: JQuery;
    elementProgresBodyH4: JQuery;
    elementRunOverlayClose: JQuery;
    elementDomainsButton: JQuery;
    elementRunOverlayProgress: JQuery;
    elementUploadJmeter: JQuery;
    elementUploadSelenium: JQuery;
    elementUploadJmx: JQuery;
    elementName: JQuery;

    totalPreviousCounter: () => number;


    stringExporting: any;
    datepicker: {
        formatDate(format: string, date: Date): string;
    };

    domainOverlay(param: string): void;
    domainDownloadOverlay(p1: any): void;
    closeOverlay(): void;

    cancelTest(): void;

    stopRecording(): void;

    resetRecording(): void;

    testEndedOverlay(): void;
    exportSelectedDomains(): void;
    uploadSelectedDomains(): void;

    disableBtn(selector: string): void;
    enableBtn(selector: string): void;

    enableDropdownBtn(selector: string): void;
    disableDropdownBtn(selector: string): void;

    dismissTest(): void;

    waitOverlay(param: any): void;
    selectTheme(theme: string): void;
}

interface JQuery {
    tooltip(): void;
    slider(p1: any, p2?: any, p3?: any): any;
    chosen(p1?: any): void;
    autocomplete(p1?: any): void;
}

// Implemented in bg-recorder-ui.js file
interface BackgroundRecorderUI {
    currentSuite: any;
    defaultTestName: string;
}

// declare function getRecorder(input: any): any;
