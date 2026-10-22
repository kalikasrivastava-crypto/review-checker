/** Reads a file as text in the browser and reports how far along it is (0 to 100). Nothing is uploaded anywhere. */
export function readTextWithProgress(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    reader.onload = () => {
      onProgress(100);
      resolve(String(reader.result ?? ""));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}
