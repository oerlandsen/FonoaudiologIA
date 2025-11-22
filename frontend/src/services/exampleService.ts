interface ExamplesData {
  read: string[];
  description: string[];
  question: string[];
}

class ExampleService {
  private examples: ExamplesData | null = null;
  private loadPromise: Promise<ExamplesData> | null = null;

  async loadExamples(): Promise<ExamplesData> {
    if (this.examples) {
      return this.examples;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = fetch('/data/examples.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load examples');
        }
        return response.json();
      })
      .then(data => {
        this.examples = data;
        return data;
      })
      .catch(error => {
        console.error('Error loading examples:', error);
        this.examples = {
          read: [],
          description: [],
          question: []
        };
        return this.examples;
      });

    return this.loadPromise;
  }

  async getRandomExample(type: 'read' | 'description' | 'question'): Promise<string> {
    const examples = await this.loadExamples();
    const typeExamples = examples[type] || [];
    
    if (typeExamples.length === 0) {
      const fallbacks = {
        read: 'El veloz zorro marrón salta sobre el perro perezoso. Esta frase contiene muchas letras del alfabeto y es comúnmente utilizada para pruebas.',
        description: 'https://static.independent.co.uk/s3fs-public/thumbnails/image/2014/09/19/16/Pivot-Friends.jpg',
        question: '¿Cuáles son tus objetivos para mejorar tu habla?'
      };
      return fallbacks[type];
    }
    
    const randomIndex = Math.floor(Math.random() * typeExamples.length);
    return typeExamples[randomIndex];
  }
}

const exampleService = new ExampleService();
export default exampleService;