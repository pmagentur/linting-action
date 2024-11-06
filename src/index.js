const core = require('@actions/core');
const exec = require('@actions/exec');

const RegexLineParser = require('./Parser/RegexLineParser');
const XmlParser = require('./Parser/XmlParser');
const CustomParser = require("./Parser/CustomParser");

const fileSeparator = core.getInput('file-separator') || ' ';
const parserType = core.getInput('parser-type');
const relevantFileEndings = JSON.parse(core.getInput('relevant-file-endings') || '[]') || [];
const annotationLevelsMapping = JSON.parse(core.getInput('annotation-levels-map') || '{}') || {};
const annotationMaxCount = JSON.parse(core.getInput('annotation-max-count') || 800) || 800;
const annotationTruncateThreshold = JSON.parse(core.getInput('annotation-truncate-threshold') || 500) || 500;
const annotationTruncateFileThreshold = JSON.parse(core.getInput('annotation-truncate-file-threshold') || 50) || 50;
const annotationTruncateFileCount = parseInt(core.getInput('annotation-truncate-file-count')|| 10) || 10 ;
const executeCommand = core.getInput('linter-command') || 'php /Users/marcel/dev/pm/php_md/phpmd.phar /Users/marcel/dev/pm/linting-php/test.php checkstyle /Users/marcel/dev/pm/php_md/pmphpmd.xml';

/**
 * @param {string[]} files
 * @return {Promise<number>}
 */
const executeLinter = async (files) => {
    const command = executeCommand.replace('{files}', files.join(fileSeparator));
    core.info(`Executing command: ${command}`);
    return await exec.exec(command, undefined, options);
};

/**
 * ###############################
 * # Static part for all linters #
 * ###############################
 */

let linterOutput = '';
let linterErrors = '';
const options = {
    listeners: {
        stdout: (data) => {
            linterOutput += data.toString();
        },
        stderr: (data) => {
            linterErrors += data.toString();
        }
    }
};

/**
 * @param {string} linterOutput Array where each element is a line of the linter output
 */
const parseAnnotations = (linterOutput) => {
    let parser;
    const customParser = process.env.GITHUB_WORKSPACE + '/' + core.getInput('annotation-parser');
    switch (parserType.toLowerCase()) {
        case 'xml':
            core.debug('Using XML parser with path ' + customParser);
            parser = new XmlParser(customParser, annotationLevelsMapping);
            break;
        case 'custom':
            core.debug('Using custom parser with path ' + customParser);
            parser = new CustomParser(customParser, annotationLevelsMapping);
            break;
        case 'regex': // Fallthrough
        default:
            const pattern = core.getInput('parse-pattern');
            core.debug('Using regex parser with pattern ' + pattern);
            parser = new RegexLineParser(new RegExp(pattern), annotationLevelsMapping);
            break;
    }

    const existingAnnotations = JSON.parse(core.getInput('annotations')) || [];
    const newAnnotations = parser.parse(linterOutput);

    if (newAnnotations.length > 0) {
        core.setFailed(`Found ${newAnnotations.length} problems in the code`);
    } else {
        core.info('No problems found in the code');
    }

    const annotations = existingAnnotations.concat(newAnnotations);

    if (annotations.length > annotationTruncateThreshold) {
        core.debug(`Found more than ${annotationTruncateThreshold} annotations, truncating per file`);
        const annotationsPerFile = {};
        for (const annotation of newAnnotations) {
            if (!annotationsPerFile[annotation.path]) {
                annotationsPerFile[annotation.path] = [];
            }
            annotationsPerFile[annotation.path].push(annotation);
        }

        const truncatedAnnotations = [];
        for (const file in annotationsPerFile) {
            const fileAnnotations = annotationsPerFile[file];
            if (fileAnnotations.length > annotationTruncateFileThreshold) {
                core.debug(`Found more than ${annotationTruncateFileThreshold} annotations for file ${file}, truncating`);
                truncatedAnnotations.push({
                    path: file,
                    startLine: 1,
                    endLine: 1,
                    annotationLevel: 'error',
                    message: `Found ${fileAnnotations.length} problems in the code. Only the first few annotations will be shown in this file. Check the file locally to see all.`
                })
                truncatedAnnotations.push(fileAnnotations.slice(0, 10));
            }
        }

        return truncatedAnnotations.slice(0, annotationMaxCount );
    }

    return annotations;
}

/**
 * @param {string} file
 * @return {boolean}
 */
const isRelevantFile = (file) => {
    if (relevantFileEndings.length === 0)
        return true;

    return relevantFileEndings.some(suffix => file.endsWith(suffix));
}

const getChangedFiles = () => {
    const changedFiles = core.getInput('changed-files').split(' ');
    return changedFiles.filter(file => isRelevantFile(file));
}

async function main() {
    core.debug('Starting linter action');
    core.debug('Relevant file endings: ' + relevantFileEndings);
    core.debug('Annotation levels mapping: ' + annotationLevelsMapping);
    core.debug('Parser type: ' + parserType);

    const changedFiles = getChangedFiles();
    core.debug('Changed files: ' + core.getInput('changed-files'));
    if (changedFiles.length === 0) {
        core.info('No relevant files changed');
        return;
    }

    try {
        await executeLinter(changedFiles);
    } catch (error) {
        core.setFailed(`Caught error while executing linter: ${error}`);
    }

    core.debug('Linter output: \n' + linterOutput);
    const annotations = parseAnnotations(linterOutput);
    core.debug('Annotations: ' + JSON.stringify(annotations));
    core.setOutput('annotations', annotations);

    if (linterErrors) {
        core.setFailed(linterErrors);
    }
}

main().catch((error) => core.setFailed(error.message));
