const BaseParser = require("./BaseParser");

module.exports = class CustomParser extends BaseParser {
    constructor(annotationParserPath, annotationLevelsMapping = null) {
        super(annotationLevelsMapping);
        this.annotationParserPath = annotationParserPath;
    }

    parse(linterOutput) {
        const {getAnnotationsFromXml} = require(this.annotationParserPath);
        const annotations = getAnnotationsFromXml(linterOutput);

        for (const annotation of annotations) {
            annotation.path = this.getRelativePath(annotation.path);
            annotation.annotationLevel = this.getLevel(annotation.annotationLevel);
        }

        return annotations;
    }
}
