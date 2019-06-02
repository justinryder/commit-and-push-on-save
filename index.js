const args = require('args');
const shell = require('shelljs');
const watch = require('watch');

const execPromise = (...args) =>
  new Promise((resolve, reject) =>
    shell.exec(...args, (code, stdout, stderr) =>
      code ?
        reject(stderr) :
        resolve(stdout)
    ));

const pipe = (...fns) =>
  (arg) =>
    fns.reduce((val, fn) => fn(val), arg);

const pipePromise = (...promises) =>
  (arg) =>
    promises.reduce(
      (last, next) => last.then(next),
      new Promise(resolve => resolve(arg))
  );
    // promises.reduce((val, promise) => promise(val).then(), arg);

if (!shell.which('git')) {
  shell.echo('This script requires git');
  shell.exit(1);
}

args
  .option('path', 'The path to watch for changes', '/');

const options = args.parse(process.argv);

const gitAdd = () => execPromise('git add .');
const gitCommit = () => execPromise('git commit -a -m "Auto-commit"');
const gitPush = () => execPromise('git push');

const shipIt = pipePromise(
  gitAdd,
  gitCommit,
  gitPush,
);

shipIt();

// watch.createMonitor(options.path, monitor => {
//   monitor.on('created', () => {
//     shipIt();
//   });
//
//   monitor.on('changed', () => {
//     shipIt();
//   });
//
//   monitor.on('removed', () => {
//     shipIt();
//   });
// });
