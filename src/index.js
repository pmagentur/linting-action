const core = require('@actions/core');
const exec = require('@actions/exec');


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
    return await exec.exec(executeCommand + ' ' + files.join(' '), undefined, options);
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
 * @param {string} level
 * @return {string}
 */
const getLevel= (level) => {
    return annotationLevelsMapping[level] || defaultAnnotationLevel;
};

/**
 * @param {string} line A line of the linter output
 * @return {null|{endLine: string, path: string, startLine: string, annotationLevel: string, message: string}}
 */
const parseLine = (line) => {
    const res = parsePattern.exec(line);
    if (!res)
        return null;

    return {
        path: res.groups.file.replace(process.cwd() + '/', ''),
        startLine: res.groups.line,
        endLine: res.groups.line,
        annotationLevel: getLevel(res.groups.level || defaultAnnotationLevel),
        message: res.groups.message
    };
};

/**
 * @param {string[]} linterOutput Array where each element is a line of the linter output
 */
const parseAnnotations = (linterOutput) => {
    const annotations = [];
    for (const line of linterOutput) {
        const parsedLine = parseLine(line);
        if (parsedLine)
            annotations.push(parsedLine);
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
    const changedFiles = getChangedFiles();
    if (changedFiles.length === 0) {
        core.info('No relevant files changed');
        return;
    }

    try {
        await executeLinter(changedFiles);
    } catch (error) {}

    const result = linterOutput.split('\n');
    const annotations = parseAnnotations(result);
    core.setOutput('annotations', annotations);

    if (linterErrors) {
        core.setFailed(linterErrors);
        return;
    }

    if (annotations.length > 0) {
        core.setFailed(`Found ${annotations.length} problems in the code`);
    }
}

main().catch((error) => core.setFailed(error.message));
