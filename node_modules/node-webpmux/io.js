/*
    node-webpmux - NodeJS module for interacting with WebP images
    Copyright (C) 2023  ApeironTsuka

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.
*/


let fs = {};
if (typeof window === 'undefined') {
  const _fs = require('fs');
  const { promisify } = require('util');
  const { basename } = require('path');
  fs = {
    read: promisify(_fs.read),
    write: promisify(_fs.write),
    open: promisify(_fs.open),
    close: promisify(_fs.close),
    basename,
    avail: true
  };
} else {
  let f = async () => { throw new Error('Running inside a browser; filesystem support is not available'); };
  fs = {
    read: f,
    write: f,
    open: f,
    close: f,
    basename: f,
    err: f,
    avail: false
  };
}
module.exports = fs;
