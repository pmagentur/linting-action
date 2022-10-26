const BaseParser = require('./BaseParser');

module.exports = class RegexLineParser extends BaseParser {
    constructor(parsePattern, annotationLevelsMapping = null) {
        super(annotationLevelsMapping);
        this.parsePattern = parsePattern;
    }

    /**
     * @inheritDoc
     */
    parse(linterOutput) {
        const annotations = [];
        const lines = linterOutput.split('\n');
        for (const line of lines) {
            const parsedLine = this.parseLine(line);
            if (parsedLine)
                annotations.push(parsedLine);
        }

        return annotations;
    }

    /**
     * @param {string} line A line of the linter output
     * @return {null|{endLine: string, path: string, startLine: string, annotationLevel: string, message: string}}
     */
    parseLine(line) {
        const res = this.parsePattern.exec(line);
        if (!res)
            return null;

        if (res.groups === undefined)
            return null;

        return {
            path: res.groups.file.replace(process.cwd() + '/', ''),
            startLine: res.groups.line,
            endLine: res.groups.line,
            annotationLevel: this.getLevel(res.groups.level || this.defaultAnnotationLevel),
            message: res.groups.message
        };
    };
}
