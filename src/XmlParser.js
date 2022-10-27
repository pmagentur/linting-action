const BaseParser = require("./BaseParser");
const {XMLParser} = require("fast-xml-parser");

module.exports = class XmlParser extends BaseParser {
    constructor(annotationParserPath, annotationLevelsMapping = null) {
        super(annotationLevelsMapping);

        const options = {
            ignoreAttributes: false,
            allowBooleanAttributes: true
        };
        this.xmlParser = new XMLParser(options);
        this.annotationParserPath = annotationParserPath;
    }

    parse(linterOutput) {
        const {getAnnotationsFromXml} = require(this.annotationParserPath);
        const annotations = getAnnotationsFromXml(this.xmlParser.parse(linterOutput));

        for (const annotation of annotations) {
            annotation.path = this.getRelativePath(annotation.path);
            annotation.annotationLevel = this.getLevel(annotation.annotationLevel);
        }

        return annotations;
    }
}
