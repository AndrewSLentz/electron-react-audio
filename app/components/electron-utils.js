import path from 'path';
import fs from 'fs';
import electron from 'electron';

// Helper to get the electron app directory
const getElectronAppDirectory = (electronInstance) => {
  const appPath = electronInstance.remote.app.getAppPath();
  return path.dirname(appPath);
};

// Synchronously checks if a path exists
const directoryExists = (dpath) => {
  try {
    return fs.lstatSync(dpath).isDirectory();
  } catch (e) {
    return false;
  }
};

// Synchronously creates a directory
const mkdirp = (dirname) => {
  const nDirname = path.normalize(dirname).split(path.sep);
  nDirname.forEach((sdir, index) => {
    const pathInQuestion = nDirname.slice(0, index + 1).join(path.sep);
    if ((!directoryExists(pathInQuestion)) && pathInQuestion) fs.mkdirSync(pathInQuestion);
  });
};

// Helper to make sure that files are created
// in the correct electron subdirectory
const makeElectronPath = (subPath) => {
  // Get the path to Electron's storage
  const fullpath = path.join(getElectronAppDirectory(electron), subPath);
  mkdirp(fullpath);
  return fullpath;
};

export {
  getElectronAppDirectory,
  directoryExists,
  mkdirp,
  makeElectronPath,
};
