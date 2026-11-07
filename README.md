# ImageHost

A responsive image hosting app built with Next.js, React, Tailwind CSS, and Cloudinary. The browser uploads the original image directly to Cloudinary. A Next.js route signs each upload request so the Cloudinary API secret stays server-side. Successful uploads return Cloudinary's permanent public HTTPS URL.

## Requirements

- Node.js 20.9 or newer
- A Cloudinary account (the free plan is enough to get started)

## Configure Cloudinary

1. Create or sign in to an account at [Cloudinary](https://cloudinary.com/).
2. From the Cloudinary Console dashboard, copy your **Cloud name**, **API Key**, and **API Secret**.
3. Copy `.env.example` to `.env.local` and fill in the credentials:

   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   MAX_UPLOAD_SIZE_MB=10
   ```

   Keep `.env.local` private. It is excluded from Git. Never add the API secret to a `NEXT_PUBLIC_` variable or client-side code.

The signing route validates the requested file extension and byte size, then signs a unique public ID in the `imagehost` folder. The browser sends the original file and signature to Cloudinary over HTTPS. Cloudinary returns the permanent `secure_url` used by the preview, Copy Link, and Open Image actions. Uploads are public by design so anyone with the URL can view them.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set the Cloudinary credentials before uploading. You can change `MAX_UPLOAD_SIZE_MB` in `.env.local` (default 10 MB); restart the dev server after changing environment values.

## Deploy

Deploy to a Node.js host such as Vercel:

1. Push this project to a Git repository.
2. Import the repository into your hosting provider.
3. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and optionally `MAX_UPLOAD_SIZE_MB` as server-side environment variables in the host dashboard.
4. Deploy using the default Next.js build command (`npm run build`) and start command (`npm run start`), or the provider's Next.js preset.

Do not put storage credentials in the browser or commit `.env.local`. The app needs a server runtime for `/api/signature`.

## Notes

- Supported formats: PNG, JPG/JPEG, WEBP, GIF, SVG, BMP, ICO, and AVIF.
- File type and size are checked in the browser and again on the server before signing.
- Uploads use Cloudinary's image upload endpoint and preserve the original image format and quality.
- No upload history is stored in this app; keep the returned public link to find the image again.
