var ThrottleGroup = require('stream-throttle').ThrottleGroup;
var Immutable     = require('immutable');

require("browser-sync")({
    server: "app",
    files: "app/**",
    open: false,
    middleware: function (req, res, next) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        next();
    },
    snippetOptions: {
        blacklist: ["/", "/**"]
    }
}, throttle);

var speeds = {
    "3g": 75,
    "edge": 25,
    "gprs": 5
};

/**
 *
 */
function throttle (err, bs) {

    var options = {
        local_host:  'localhost',
        remote_host: 'localhost',
        upstream:    10*1024,
        downstream:  speeds["3g"] * 1024,
        keepalive:   false
    };

    var upThrottle = new ThrottleGroup({ rate: options.upstream });
    var downThrottle = new ThrottleGroup({ rate: options.downstream });

    var url = require("url").parse(bs.options.getIn(["urls", "local"]));

    var utils = require("browser-sync/lib/server/utils.js");

    var certs = utils.getKeyAndCert(Immutable.Map({scheme: "https"}));
    var opts = {
        key: certs.key,
        cert: certs.cert,
        allowHalfOpen: true,
        rejectUnauthorized: false
    };

    var server = require("net").createServer(opts, function (local) {

        var remote = require("net").createConnection({
            host: url.hostname,
            port: url.port,
            allowHalfOpen: true,
        });

        var localThrottle = upThrottle.throttle();
        var remoteThrottle = downThrottle.throttle();

        local
            .pipe(localThrottle)
            .pipe(remote);

        local.on('error', function(err) {
            //console.log("Local Error: ", err);
            remote.destroy();
            local.destroy();
        });

        remote
            .pipe(remoteThrottle)
            .pipe(local);

        remote.on('error', function(err) {
            //console.log("Remote err: ", err);
            local.destroy();
            remote.destroy();
        });
    });

    server.listen(8989, "0.0.0.0");

    server.on('listening', function() {
        require("opn")("https://localhost:8989");
        //var localAddr = options.local_host + ':' + options.local_port;
        //var remoteAddr = options.remote_host + ':' + options.remote_port;
        //grunt.log.writeln('Throttling connections to ' + remoteAddr + ', go to ' + localAddr);
    });

    server.on('error', function(err) {
        console.log(err);
    });
}
