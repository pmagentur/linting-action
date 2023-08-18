const core = require('@actions/core');
const exec = require('@actions/exec');

const RegexLineParser = require('./Parser/RegexLineParser');
const XmlParser = require('./Parser/XmlParser');
const CustomParser = require("./Parser/CustomParser");

const fileSeparator = core.getInput('file-separator') || ' ';
const parserType = core.getInput('parser-type');
const relevantFileEndings = JSON.parse(core.getInput('relevant-file-endings') || '[]') || [];
const excludedDirectories = JSON.parse(core.getInput('excluded-directories') || '[]') || [];
const annotationLevelsMapping = JSON.parse(core.getInput('annotation-levels-map') || '{}') || {};
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

    return existingAnnotations.concat(newAnnotations);
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

/**
 * @param {string} file
 * @return {boolean}
 */
const isExcludedDirectory = (file) => {
    if (excludedDirectories.length === 0)
        return false;

    return excludedDirectories.some(directory => file.startsWith(directory));
}

/**
 * @param {string} file
 * @return {boolean}
 */
const isValidFile = (file) => {
    return isRelevantFile(file) && !isExcludedDirectory(file);
}

const getChangedFiles = () => {
    const changedFiles = core.getInput('changed-files').split(' ');
    return changedFiles.filter(file => isValidFile(file));
}

async function main() {
    core.debug('Starting linter action');
    core.debug('Relevant file endings: ' + relevantFileEndings);
    core.debug('Annotation levels mapping: ' + annotationLevelsMapping);
    core.debug('Parser type: ' + parserType);

    const changedFiles = getChangedFiles();
    core.debug('Changed files: ' + changedFiles.join(', '));
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
