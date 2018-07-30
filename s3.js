var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var myBucket = 'fileshell';

var s3_aws = {};

s3_aws.addUser = function addDefaultFolder(username){
  var dir = username + "/file/"
  var params = {Bucket: myBucket, Key: dir};
  s3.putObject(params, function(err, data) {
    if (err) {
      console.log(err)
    } else {
      console.log("Successfully Add Default Folder to" + myBucket + ' ' + username);
    }
  });
}

s3_aws.addFolder = function addNewFolder(username, folderDir){
  params = {Bucket: myBucket, Key: username + folderDir};
  s3.putObject(params, function(err, data) {
    if (err) {
      console.log(err)
    } else {
      console.log("Successfully Add New Folder to" + myBucket + ' ' + folderDir);

    }
  });
}

s3_aws.addFile = function(files, dir){
  var params = {Bucket: myBucket, Key: dir, Body: files};
  s3.upload(params).on('httpUploadProgress', function (evt) { console.log(evt); }).
      send(function (err, data) {
        //S3 File URL
        var url = data.Location
        console.log(url);
        //어디에서나 브라우저를 통해 접근할 수 있는 파일 URL을 얻었습니다.
      })
}

s3_aws.downloadFile = function(dir, res){
  params = {Bucket: myBucket, Key: dir};
  s3.getSignedUrl('getObject', params, function(err, data) {
    if (err) {
      console.log(err)
    } else {
      res.redirect(data);
      console.log("Successfully Download New Folder to" + myBucket+ ' ' + dir );
    }
  });
}

s3_aws.deleteFile = function(dir){
  params = {Bucket: myBucket, Key: dir};
  s3.deleteObject(params, function(err, data) {
    if (err) {
      console.log(err)
    } else {
      console.log("Successfully Delete file" + myBucket+ ' ' + dir );
    }
  });
}

s3_aws.deleteFolder = function(dir){

}

// s3_aws.deleteFolder = async function(dir){
//   var params = {Bucket: myBucket, Prefix: dir};
//   const listedObjects = await s3.listObjectsV2(params).promise();
//
//   if (listedObjects.Contents.length === 0) return;
//
//     const deleteParams = {
//         Bucket: myBucket,
//         Delete: { Objects: [] }
//     };
//
//     listedObjects.Contents.forEach(({ Key }) => {
//         deleteParams.Delete.Objects.push({ Key });
//     });
//
//     await s3.deleteObjects(deleteParams).promise();
//
//     if (listedObjects.Contents.IsTruncated) await deleteFolder(myBucket, dir);
// }

// s3_aws.addFile = function(files, dir){
//   var params = {Bucket: myBucket, Key: dir, Body: files};
//   s3.upload(params, function(err, data) {
//     if (err) {
//       console.log(err)
//     } else {
//       console.log("Successfully Upload New File to" + myBucket);
//     }
//   });
// }

module.exports = s3_aws;
