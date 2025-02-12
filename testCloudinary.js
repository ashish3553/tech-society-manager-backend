// testCloudinary.js
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || coders_care,
  api_key: process.env.CLOUDINARY_API_KEY ||692143192488855 ,
  api_secret: process.env.CLOUDINARY_API_SECRET || y5YBnolpqm5Z00AMyKduRKRkxjI,
});

// URL of an image to upload (you can also use a local file path with additional code)
const imageUrl = 'https://via.placeholder.com/150';

cloudinary.uploader.upload(imageUrl, { folder: 'test_folder' }, (error, result) => {
  if (error) {
    console.error('Cloudinary upload error:', error);
  } else {
    console.log('Cloudinary upload result:', result);
  }
});
