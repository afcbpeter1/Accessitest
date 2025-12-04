import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  // Parse the CLOUDINARY_URL if provided
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dyzzpsxov',
    api_key: process.env.CLOUDINARY_API_KEY || '889181634366452',
    api_secret: process.env.CLOUDINARY_API_SECRET || '5nHMKvoyXjsgxS36GhLtJV0xNrw',
  })
} else {
  // Fallback to individual environment variables
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  bytes: number
}

export class CloudinaryService {
  /**
   * Upload a base64 image to Cloudinary
   */
  static async uploadBase64Image(
    base64Data: string,
    folder: string = 'a11ytest',
    options: {
      public_id?: string
      transformation?: any
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
      
      const result = await cloudinary.uploader.upload(
        `data:image/png;base64,${base64String}`,
        {
          folder: folder,
          public_id: options.public_id,
          transformation: options.transformation,
          resource_type: 'image',
          format: 'png',
          quality: 'auto',
          fetch_format: 'auto'
        }
      )

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error)
      throw new Error(`Failed to upload image to Cloudinary: ${error}`)
    }
  }

  /**
   * Upload multiple base64 images to Cloudinary
   */
  static async uploadMultipleImages(
    images: Array<{
      base64Data: string
      public_id?: string
      folder?: string
    }>
  ): Promise<CloudinaryUploadResult[]> {
    try {
      const uploadPromises = images.map(async (image) => {
        return await this.uploadBase64Image(
          image.base64Data,
          image.folder || 'a11ytest',
          { public_id: image.public_id }
        )
      })

      return await Promise.all(uploadPromises)
    } catch (error) {
      console.error('Cloudinary batch upload error:', error)
      throw new Error(`Failed to upload images to Cloudinary: ${error}`)
    }
  }

  /**
   * Delete an image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (error) {
      console.error('Cloudinary delete error:', error)
      throw new Error(`Failed to delete image from Cloudinary: ${error}`)
    }
  }

  /**
   * Get image URL with transformations
   */
  static getImageUrl(
    publicId: string,
    transformations: any = {}
  ): string {
    return cloudinary.url(publicId, {
      ...transformations,
      secure: true
    })
  }
}

export default CloudinaryService
