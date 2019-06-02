const args = require('args');
const path = require('path');
const shell = require('shelljs');
const watch = require('watch');

const resolvedPromise = value => new Promise(resolve => resolve(value));

const execPromise = (command) =>
  new Promise(resolve => shell.exec(command, resolve));

const pipe = (...fns) =>
  (arg) =>
    fns.reduce((val, fn) => fn(val), arg);

const pipePromise = (...promises) =>
  (arg) =>
    promises.reduce(
      (last, next) => last.then(next),
      new Promise(resolve => resolve(arg))
  );

if (!shell.which('git')) {
  shell.echo('This script requires git');
  shell.exit(1);
}

args
  .option('path', 'The path to watch for changes', '/')
  .option('count-start', 'The number to start counting commits from', 1);

const options = args.parse(process.argv);

const gitAdd = () => execPromise('git add .');
const gitCommitWithMessage = prefix => message => execPromise(`git commit -a -m "${prefix}${message}"`);
const gitCommit = () => gitCommitWithMessage('Auto-commit')();
const gitPush = () => execPromise('git push');
const gitHasChanges = () =>
  execPromise('git diff --exit-code --quiet')
    .then(code => Boolean(code));

const log = message =>
  value => console.log(message) || resolvedPromise(value);

const rejectIfFalse = value =>
  new Promise((resolve, reject) => value ? resolve(value) : reject(value));

const rejectWithMessageIfFalse = message =>
  value =>
    new Promise((resolve, reject) => value ? resolve(value) : reject(message));

const makeCounter = (value = 0) =>
  () => value++;

const commitCounter = makeCounter(options['count-start']);

const shipIt = arg =>
  pipePromise(
    log('Attempting to "ship it"'),
    gitHasChanges,
    rejectWithMessageIfFalse('git diff shows no changes'),
    gitAdd,
    commitCounter,
    gitCommitWithMessage('Auto-commit #'),
    gitPush,
  )(arg).then(null, message => console.log('Error "shipping it":', message));

const matches = pattern =>
  value =>
    Boolean(value.match(pattern));

const doesNotMatch = pattern =>
  value =>
    !matches(pattern)(value);

const doesNotMatchAny = (...patterns) =>
  value =>
    patterns.map(pattern => doesNotMatch(pattern))
      .every(noMatch => noMatch(value));

watch.createMonitor(
  path.join(__dirname, options.path),
  {
    filter: doesNotMatchAny(
      /\.git/i,
      /node_modules/i,
    ),
  },
  monitor => {
    monitor.on('created', (f, stat) => {
      console.log('New file detected');
      shipIt();
    });

    monitor.on('changed', (f, curr, prev) => {
      console.log('File change detected');
      shipIt();
    });

    monitor.on('removed', (f, stat) => {
      console.log('File removal detected');
      shipIt();
    });
  }
);
