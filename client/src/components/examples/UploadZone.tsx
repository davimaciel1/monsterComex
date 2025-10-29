import { UploadZone } from '../UploadZone';

export default function UploadZoneExample() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <UploadZone onFileSelect={(file) => console.log('File:', file)} />
    </div>
  );
}
