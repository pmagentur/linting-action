module.exports = class BaseParser {
    defaultAnnotationLevel = 'failure';
    annotationLevelsMapping = {
        "err": "failure",
        "error": "failure",
        "failure": "failure",
        "warn": "warning",
        "warning": "warning",
        "info": "notice",
        "notice": "notice"
    }

    constructor(annotationLevelsMapping = null) {
        if (annotationLevelsMapping && Object.keys(annotationLevelsMapping).length > 0) {
            this.annotationLevelsMapping = annotationLevelsMapping;
        }
    }

    /**
     * @param linterOutput
     * @return {{endLine: string, path: string, startLine: string, annotationLevel: string, message: string}[]}
     */
    parse(linterOutput) {
        throw new Error('Not implemented');
    }

    /**
     * @param {string} level
     * @return {string}
     */
    getLevel(level) {
        return this.annotationLevelsMapping[level?.toLowerCase()] || this.defaultAnnotationLevel;
    };

    getRelativePath(path) {
        return path.replace(process.cwd() + '/', '')
    }
}

