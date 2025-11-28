import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary - SECURITY: All credentials must be provided via environment variables
const cloud_name = process.env.CLOUDINARY_CLOUD_NAME
const api_key = process.env.CLOUDINARY_API_KEY
const api_secret = process.env.CLOUDINARY_API_SECRET

// If CLOUDINARY_URL is provided, use it (it contains all credentials)
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: cloud_name,
    api_key: api_key,
    api_secret: api_secret,
  })
} else {
  // Require individual environment variables - no fallbacks for security
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      'Cloudinary credentials must be set in environment variables. ' +
      'Provide either CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET'
    )
  }
  
  cloudinary.config({
    cloud_name: cloud_name,
    api_key: api_key,
    api_secret: api_secret,
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
