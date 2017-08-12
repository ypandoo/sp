/**
 * Created by yuhailong on 07/04/2017.
 */
var i18n = require('i18n');
var _ = require('lodash');
i18n.configure({
    directory: __dirname + "/../locale"
});
var errors = require("../errcode.js");
const commonFunc = require("./CommonFuncs");
var ConfigInfos = Parse.Object.extend("configinfos");
var BandUser = Parse.Object.extend("BandUser");
var ActivityInfos = Parse.Object.extend("activityinfos");
var GuideInfos = Parse.Object.extend("guideinfos");
var AppVersion = Parse.Object.extend("versioninfos");


exports.sendSMSCode = function (req, res) {
    commonFunc.setI18n(req, i18n);
    const phoneNumber = req.params.phonenum;

    if (typeof phoneNumber === "undefined") {
        res.error(errors["noPhoneNb"], i18n.__("noPhoneNb"));
        logger.error(i18n.__("noPhoneNb"), { "req": req });
        return;
    }

    const reg = /^1[0-9]{10}$/;
    if (!reg.test(phoneNumber)) {
        logger.error(i18n.__("invalidPhoneFormat"), { "req": req });
        return res.error(errors["invalidPhoneFormat"], i18n.__("invalidPhoneFormat"));
    }

    commonFunc.hasSmsSendAuth(phoneNumber).
    then(function (ret) {
        return commonFunc.sendSmsCode(phoneNumber);
    }, function (err) {
        logger.error(err, { "req": req });
        res.error(errors[err], i18n.__(err));
        reject(err);
        return;
    })
    .then(function (doc) {
        return commonFunc.hiddenPhoneNo(phoneNumber);
    }, function (err) {
        logger.error( err, { "req": req });
        res.error(errors["smsCodeFrequent"], i18n.__("smsCodeFrequent"));
        reject(err);
        return;
    }).then(function (finalNo) {
        let smsLogs = new SmsLogs();
        smsLogs.set("phoneNo", phoneNumber);
        return smsLogs.save(null, { useMasterKey: true });
    }).then(function(){
        let ret = {};
        ret.phoneNumber = finalNo;
        res.success(ret);
    }, function (err) {
        logger.error( err, { "req": req });
        res.error(errors["internalError"], i18n.__("internalError"));
    });

};



/**
 * Start for the Admin UI controlled modules
 */

exports.getSettings = function (req, res) {
    commonFunc.setI18n(req, i18n);
    if (typeof req.params === "undefined" || typeof req.params.alias === "undefined") {
        ParseLogger.log("warn", "Not provide the params or params.alias", { "req": req });
        res.error(errors["invalidParameter"], i18n.__("invalidParameter"));
        return;
    }
    var alias = req.params.alias;
    if (alias === null) {
        ParseLogger.log("warn", "The alias is null", { "req": req });
        res.error(errors["invalidParameter"], i18n.__("invalidParameter"));
        return;
    }
    Parse.Cloud.useMasterKey();
    var configInfosQuery = new Parse.Query(ConfigInfos);

    if (alias.length === 0) {
        configInfosQuery.find({ useMasterKey: true }).then(function (docs) {
            var ret = {};
            if (docs && docs.length > 0) {
                for (var i = 0; i < docs.length; i++) {
                    var itemAlias = docs[i].get("alias");
                    var itemValue = docs[i].get("value");
                    try {
                        var jsonValue = JSON.parse(itemValue);
                        ret[itemAlias] = jsonValue;
                    }
                    catch (e) {
                        ret[itemAlias] = itemValue;
                    }

                }
            }
            res.success(ret);
        }, function (err) {
            ParseLogger.log("error", err, { "req": req });
            res.error(errors["internalError"], i18n.__("internalError"));
        });
    } else {
        configInfosQuery.find({ useMasterKey: true }).then(function (docs) {
            var ret = {};
            if (docs && docs.length > 0) {
                for (var i = 0; i < docs.length; i++) {
                    var itemAlias = docs[i].get("alias");
                    for (var k = 0; k < alias.length; k++) {
                        if (alias[k] === itemAlias) {
                            var itemValue = docs[i].get("value");
                            try {
                                var jsonValue = JSON.parse(itemValue);
                                ret[itemAlias] = jsonValue;
                            }
                            catch (e) {
                                ret[itemAlias] = itemValue;
                            }
                            break;
                        }
                    }
                }
            }
            res.success(ret);
        }, function (err) {
            ParseLogger.log("error", err, { "req": req });
            res.error(errors["internalError"], i18n.__("internalError"));
        });
    }

};

// exports."validSmsCode", function (req, res) {
//     commonFunc.setI18n(req, i18n);
//     if (typeof req.params === "undefined" || typeof req.params.phoneno === "undefined") {
//         ParseLogger.log("warn", "Not provide the params or params.phoneno", {"req": req});
//         res.error(errors["noPhoneNb"], i18n.__("noPhoneNb"));
//         return;
//     }
//     if (typeof req.params === "undefined" || typeof req.params.code === "undefined") {
//         ParseLogger.log("warn", "Not provide the params.code", {"req": req});
//         res.error(errors["noSmsCode"], i18n.__("noSmsCode"));
//         return;
//     }
//     var phoneno = req.params.phoneno;
//     var code = req.params.code;
//     commonFunc.validSmsCode(phoneno, code).then(function (doc) {
//         if (!doc) {
//             ParseLogger.log("warn", "The SMS code is invalid", {"req": req});
//             res.error(errors["invalidSmsCode"], i18n.__("invalidSmsCode"));
//             return;
//         }
//         var ret = {};
//         ret.valid = "1";
//         res.success(ret);
//         return;
//     }, function (err) {
//         ParseLogger.log("error", err, {"req": req});
//         res.error(errors[err], i18n.__(err));
//     });
// });

exports.getAppVersions = function (req, res) {
    commonFunc.setI18n(req, i18n);

    Parse.Cloud.useMasterKey();
    Parse.User.enableUnsafeCurrentUser();
    var query = new Parse.Query(AppVersion);
    query.equalTo('current', true);
    query.equalTo('type', 'android')
    query.descending('createdAt');


    query.first({
        useMasterKey: true
    }).then(function (v) {
        // If not, create a new user.
        if (!v) {
            ParseLogger.log("warn", "Cannot find the version data", { "req": req });
            return res.error(errors["noData"], i18n.__("noData"));
        }
        res.success({
            "name": v.get("name"),
            "code": v.get("code"),
            "releasedate": v.get("releaseDate"),
            "memo": v.get("memo"),
            "forceupdate": v.get("forceUpdate") ? 1 : 0,
            "url": v.get("url"),
            "size": v.get("size")
        })
        var b = true;

    }, function (err) {
        ParseLogger.log("error", err, { "req": req });
        res.error(errors["internalError"], i18n.__("internalError"));
    });

};

exports.uploadEvents = function (req, res) { };
exports.instantiateApp = function (req, res) { };

exports.updateInstance = function (req, res) { };