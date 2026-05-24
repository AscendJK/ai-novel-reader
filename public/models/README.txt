AI Novel Reader - Model Files Directory
=======================================

Place downloaded ONNX model files here for offline use.
These files are NOT included in the Git repository.

Directory structure:

  public/models/Xenova/
    bge-small-zh-v1.5/          (Recommended for Chinese novels, ~26MB)
      config.json
      tokenizer.json
      onnx/
        model_quantized.onnx

    multilingual-e5-small/       (Multi-language, ~120MB)
      config.json
      tokenizer.json
      onnx/
        model_quantized.onnx

Download links (Hugging Face, Xenova quantized versions):

  BGE Small ZH:
    https://huggingface.co/Xenova/bge-small-zh-v1.5

  E5 Small:
    https://huggingface.co/Xenova/multilingual-e5-small

After placing the files, restart the dev server and refresh the page.
