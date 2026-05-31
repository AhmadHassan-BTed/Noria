Netmask
=======

The Netmask class parses and understands IPv4 and IPv6 CIDR blocks so they can be explored and compared. This module is highly inspired by Perl [Net::Netmask](http://search.cpan.org/dist/Net-Netmask/) module.

Synopsis
--------

### IPv4

```js
var Netmask = require('netmask').Netmask

var block = new Netmask('10.0.0.0/12');
block.base;                     // 10.0.0.0
block.mask;                     // 255.240.0.0
block.bitmask;                  // 12
block.hostmask;                 // 0.15.255.255
block.broadcast;                // 10.15.255.255
block.size;                     // 1048576
block.first;                    // 10.0.0.1
block.last;                     // 10.15.255.254

block.contains('10.0.8.10');    // true
block.contains('10.8.0.10');    // true
block.contains('192.168.1.20'); // false

block.next()                    // Netmask('10.16.0.0/12')
```

### IPv6

```js
var Netmask = require('netmask').Netmask

var block = new Netmask('2001:db8::/32');
block.base;                     // 2001:db8::
block.bitmask;                  // 32
block.first;                    // 2001:db8::
block.last;                     // 2001:db8:ffff:ffff:ffff:ffff:ffff:ffff

block.contains('2001:db8::1');  // true
block.contains('2001:db9::1');  // false

block.next()                    // Netmask('2001:db9::/32')
```

Constructing
------------

Netmask objects are created with an IP address and optionally a mask. The IP version is detected automatically. There are many forms that are recognized:

### IPv4

```
'216.240.32.0/24'               // The preferred form.
'216.240.32.0/255.255.255.0'
'216.240.32.0', '255.255.255.0'
'216.240.32.0', 0xffffff00
'216.240.32.4'                  // A /32 block.
'0330.0360.040.04'              // Octal form
'0xd8.0xf0.0x20.0x4'           // Hex form
```

### IPv6

```
'2001:db8::/32'                 // The preferred form.
'2001:db8::', 32
'::1'                           // A /128 block.
'::ffff:192.168.1.1/120'       // Mixed IPv4-mapped form.
'fe80::1%eth0'                  // Zone IDs are stripped.
```

API
---

- `.base`: The base address of the network block as a string (eg: 216.240.32.0 or 2001:db8::). Base does not give an indication of the size of the network block.
- `.mask`: The netmask as a string (eg: 255.255.255.0 or ffff:ffff::).
- `.hostmask`: The host mask which is the opposite of the netmask (eg: 0.0.0.255).
- `.bitmask`: The netmask as a number of bits in the network portion of the address for this block (eg: 24).
- `.size`: The number of IP addresses in a block (eg: 256).
- `.maskLong`: **Deprecated.** The netmask as an unsigned 32-bit integer. Only meaningful for IPv4; returns `0` for IPv6.
- `.netLong`: **Deprecated.** The base address as an unsigned 32-bit integer. Only meaningful for IPv4; returns `0` for IPv6.
- `.broadcast`: The blocks broadcast address (eg: 192.168.1.0/24 => 192.168.1.255). Always `undefined` for IPv6.
- `.first`, `.last`: First and last useable address.
- `.contains(ip or block)`: Returns a true if the IP number `ip` is part of the network. That is, a true value is returned if `ip` is between `base` and `broadcast`. If a Netmask object or a block is given, it returns true only of the given block fits inside the network.
- `.next(count)`: Without a `count`, return the next block of the same size after the current one. With a count, return the Nth block after the current one. A count of -1 returns the previous block. Undef will be returned if out of legal address space.
- `.toString()`: The netmask in base/bitmask format (e.g., '216.240.32.0/24')

Installation
------------

    $ npm install netmask

Run all tests
-------------

    $ npm test

License
-------

(The MIT License)

Copyright (c) 2011 Olivier Poitrey <rs@rhapsodyk.net>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
