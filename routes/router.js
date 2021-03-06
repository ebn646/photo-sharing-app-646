var User = require('../models/user');

module.exports = (express, app, formidable, fs, os, gm, knoxClient, mongoose, io) => {

    var Socket;
    //console.log('=================='+io)

    io.on('connection', function (socket) {
        console.log('=======================i am connected===========================')
        Socket = socket;

        // when the client emits 'new message', this listens and executes
        Socket.on('new message', (msg,path) => {
            console.log('==========new message sent to server ', msg, path)
        // we tell the client to execute 'new message'
        
        singleImageModel.findByIdAndUpdate(path, { $inc: { comments: 1 } }, function (err, result) {
            result.messages.push({ message: msg})
            result.save()
            .then(
            socket.broadcast.emit('new message', {message: msg, comments: result.comments}));
            socket.emit('new increment number', {comments: result.comments});
        });
      });
    });

    var singleImage = new mongoose.Schema({
        filename: String,
        votes: Number,
        comments: Number,
        messages:[]
    })

    var singleImageModel = mongoose.model('singleImage', singleImage);

    var userComment = new mongoose.Schema({ 
        name: 'string'
     });
     

    var router = express.Router();

    var host = app.get('host')

    var userId;

    router.get('/', function (req, res, next) {
        if(app.locals.isAuthenticated !== undefined){
            console.log('user is logged in')
            return res.redirect('/gallery');
        }else{
            console.log('user is logged out')
            res.render('pages/login');
        }
    });

    router.post('/upload', function (req, res, next) {
        // File upload
        function generateFilename(filename) {
            var ext_regex = /(?:\.([^.]+))?$/;
            var ext = ext_regex.exec(filename)[1];
            var date = new Date().getTime();
            var charBank = "abcdefghijklmnopqrstuvwxyz";
            var fstring = '';
            for (var i = 0; i < 15; i++) {
                fstring += charBank[parseInt(Math.random() * 26)];
            }
            return (fstring += date + '.' + ext);
        }

        var tmpFile, nfile, fname;
        var newForm = new formidable.IncomingForm();
        newForm.keepExtensions = true;
        newForm.parse(req, function (err, fields, files) {
            tmpFile = files.upload.path;
            fname = generateFilename(files.upload.name);
            nfile = os.tmpDir() + '/' + fname;
            res.writeHead(200, { 'Content-type': 'text/plain' });
            res.end();
        })

        newForm.on('end', function () {
            fs.rename(tmpFile, nfile, function () {
                // Resize the image and upload this file into the S3 bucket
                gm(nfile)
                    .resizeExact(300)
                    .write(nfile, function () {
                        // Upload to the S3 Bucket
                        fs.readFile(nfile, function (err, buf) {
                            var req = knoxClient.put(fname, {
                                'Content-Length': buf.length,
                                'Content-Type': 'image/jpeg'
                            })

                            req.on('response', function (res) {
                                if (res.statusCode == 200) {
                                    // This means that the file is in the S3 Bucket !
                                    var newImage = new singleImageModel({
                                        filename: fname,
                                        votes: 0
                                    }).save();

                                    Socket.emit('status', { 'msg': 'Saved !!', 'delay': 3000 });

                                    // Signal Front end that the file has been saved
                                    Socket.emit('doUpdate', {});

                                    // Delete the Local File
                                    fs.unlink(nfile, function () {
                                        console.log('Local File Deleted !');
                                    })
                                }
                            });
                            req.end(buf);
                        })
                    })
            })
        })
    });

    router.get('/getimages', function (req, res, next) {
        singleImageModel.find({}, null, { sort: { votes: -1 } }, function (err, result) {
            res.send(JSON.stringify(result));
        })
    }) 

    //============ ROUTE FOR ADDING A VOTE TO AN IMAGE ===============

    router.get('/voteup/:id', function (req, res, next) {
        singleImageModel.findByIdAndUpdate(req.params.id, { $inc: { votes: 1 } }, function (err, result) {
            res.send(200, { votes: result.votes });
        })
    })

    //============ ROUTE FOR ADDING A COMMENT TO AN IMAGE ===============

    router.get('/commentup/:id', function (req, res, next) {
        singleImageModel.findById(req.params.id, function (err, result) {
            console.log('result from backend = ', result)
            //res.send(JSON.stringify(result));
        });
    })

    router.get('/logout', function (req, res, next) {
        if (req.session) {
            // delete session object
            req.session.destroy(function (err) {
                if (err) {
                    return next(err);
                } else {
                    return res.redirect('/');
                }
            });
        }
    })

    router.get('/gallery', function (req, res, next) {
        if(app.locals.isAuthenticated !== undefined){
            console.log('user is logged in',app.locals.isAuthenticated);
            User.findById(app.locals.isAuthenticated, function(err,result){
                console.log('user = ', result.email);
                app.locals.user = result.email;
            })
            .then(res.render('pages/gallery',{user: app.locals.user }));
        }else{
            console.log('user is logged out',app.locals.isAuthenticated)
            return res.redirect('/');
        }
        
    })

    router.get('/admin', function (req, res, next) {
        res.render('pages/admin');
    })

    // ===================== ROUTE FOR COMMENTS PAGE =================

    router.get('/comments/:id', function (req, res, next) {
        //1. make call to mongoDB to load image
        res.render('pages/comments');
    })

    router.get('/getcomments/:id', function (req, res, next) {
        //1. make call to mongoDB to load image model
        let id = req.params.id;
        singleImageModel.findById(id, function (err, result) {
            if(err){
                console.log('There was an error = ', err)
            }else{
                //res.render('pages/comments', result);
                res.send(JSON.stringify(result));
            }
        });
    })

    //
    router.post('/', function (req, res, next) {

        // TODO:confirm that passwords match

        // 1. User is registering for the first time
        // Check that form fields are complete on sign up form or
        // Check that for fields are complete on sign in form authenticate input against database
        // if any fields are not filled out send an error back to the client
        if (req.body.email &&
            req.body.password &&
            req.body.passwordConf) {

            var userData = {
                email: req.body.email,
                password: req.body.password,
                passwordConf: req.body.passwordConf,
            }
            // if forms are fill out, add user to database and send to gallery page

            User.create(userData, function (error, user) {
                if (error) {
                    return next(error);
                } else {
                    req.session.userId = user._id;
                    return res.redirect('/gallery');
                }
            });
        } else if (req.body.logemail && req.body.logpassword) {
            console.log('LOGIN USER!!! ', req.body);

            // 2. User is already registered and is logging in
            // Authenticate user and redirect to gallery page is user is found

            User.authenticate(req.body.logemail, req.body.logpassword, function (error, user) {
                if (error || !user) {
                    var err = new Error('Wrong email or password.');
                    err.status = 401;
                    return next(err);
                } else {
                    req.session.userId = user._id;
                    console.log(' User has been found in the database while logging in')
                    return res.redirect('/gallery');
                }
            });

        } else {
            // 3. User has not filled out all of the fields
            var err = new Error('All fields required.');
            err.status = 400;
            return next(err);
        }
    });

    // get the server working with the app

    app.use('/', router);

}