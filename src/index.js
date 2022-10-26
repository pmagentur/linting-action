const core = require('@actions/core');
const exec = require('@actions/exec');

const RegexLineParser = require('./regexLineParser');

const parsePattern = new RegExp(core.getInput('parse-pattern'));
const relevantFileEndings = JSON.parse(core.getInput('relevant-file-endings')) || [];
const defaultAnnotationLevel = 'failure';
const annotationLevelsMapping = JSON.parse(core.getInput('annotation-levels-map'));
const executeCommand = core.getInput('linter-command');

/**
 * @param {string[]} files
 * @return {Promise<number>}
 */
const executeLinter = async (files) => {
    const command = executeCommand.replace('{files}', files.join(' '));
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
    const parser = new RegexLineParser(parsePattern, annotationLevelsMapping);
    return parser.parse(linterOutput);
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
    const changedFiles = getChangedFiles();
    if (changedFiles.length === 0) {
        core.info('No relevant files changed');
        return;
    }

    try {
        await executeLinter(changedFiles);
    } catch (error) {
        core.setFailed(`Caught error while executing linter: ${error}`);
    }

    const result = linterOutput.split('\n');
    const annotations = parseAnnotations(result);
    core.setOutput('annotations', annotations);

    if (annotations.length > 0) {
        core.setFailed(`Found ${annotations.length} problems in the code`);
    }

    if (linterErrors) {
        core.setFailed(linterErrors);
    }
}

main().catch((error) => core.setFailed(error.message));