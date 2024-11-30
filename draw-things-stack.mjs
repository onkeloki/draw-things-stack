import { writeFile, readFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const DRAW_THINGS_URL = 'http://127.0.0.1:7860/sdapi/v1/txt2img';
const IMG_SIZE = 512;
const MAX_FILE_NAME_LEN = 30;
const PROMPT_FILE = './_input/prompts.txt'; // Pfad zur Datei mit Prompts
const OUTPUT_DIR = './_output';

const getTime = () => new Date().toLocaleTimeString();
const now = Date.now();

const getFileName = (prompt, idx, runtime) =>
    `${prompt.replace(/[\s\/:]/g, '_').substring(0, MAX_FILE_NAME_LEN).toLowerCase()}_${now}_${runtime}_${idx}.png`;

const saveImg = async (data, prompt, idx, runtime) => {
    try {
        const fileName = getFileName(prompt, idx, runtime);
        const filePath = join(OUTPUT_DIR, fileName);
        await mkdir(OUTPUT_DIR, { recursive: true });
        await writeFile(filePath, data, 'base64');
        console.log(`Image saved: ${filePath}`);
    } catch (error) {
        console.error(`Failed to save image ${idx} for prompt "${prompt}":`, error);
    }
};

const markPromptAsDone = async (prompt) => {
    try {
        const fileContent = await readFile(PROMPT_FILE, 'utf-8');
        const prompts = fileContent.split('\n').map((line) => line.trim());
        const updatedPrompts = prompts.map((line) => (line === prompt ? `[DONE] ${line}` : line));
        await writeFile(PROMPT_FILE, updatedPrompts.join('\n'), 'utf-8');
    } catch (error) {
        console.error(`Failed to mark prompt as done: "${prompt}":`, error);
    }
};

const processPrompt = async (prompt) => {
    const params = {
        prompt,
        negative_prompt: '(worst quality, low quality, normal quality, (variations):1.4), blur:1.5',
        seed: -1,
        steps: 8,
        guidance_scale: 4,
        batch_count: 1, // Für jeden Prompt ein einzelnes Bild
        width: IMG_SIZE,
        height: IMG_SIZE,
    };

    const opts = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    };

    const startTime = Date.now();

    try {
        const res = await fetch(DRAW_THINGS_URL, opts);
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        const data = await res.json();
        if (!data.images) throw new Error('No images in response');

        const runtime = (Date.now() - startTime) / 1000;
        console.log(`Response received for prompt "${prompt}". Saving images...`);

        await Promise.all(data.images.map((img, idx) => saveImg(img, prompt, idx, runtime)));

        console.log(`Finished processing prompt "${prompt}" in ${runtime} seconds.`);

        await markPromptAsDone(prompt);
    } catch (error) {
        console.error(`Error processing prompt "${prompt}":`, error);
    }
};

const main = async () => {
    try {
        // Lese die Datei mit den Prompts
        const fileContent = await readFile(PROMPT_FILE, 'utf-8');
        const prompts = fileContent.split('\n').map((line) => line.trim()).filter((line) => line);

        console.log(`Loaded ${prompts.length} prompts from ${PROMPT_FILE}.`);

        // Verarbeite jeden Prompt
        for (const prompt of prompts) {
            if (!prompt.startsWith('[DONE]')) {
                console.log(`Processing prompt: "${prompt}"`);
                await processPrompt(prompt); // Abarbeitung nacheinander, um die API nicht zu überlasten
            }
        }

        console.log('All prompts processed.');
    } catch (error) {
        console.error('Error:', error);
    }
};

main();