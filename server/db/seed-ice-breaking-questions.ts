import { storage } from "../storage";

const iceBreakingQuestions = [
  {
    question: "你觉得合伙人之间最重要的是什么？",
    category: "values"
  },
  {
    question: "过去做项目时最骄傲的一次决策是什么？",
    category: "experience"
  },
  {
    question: "对未来创业方向有明确预期吗？",
    category: "vision"
  },
  {
    question: "你如何处理团队内部的意见分歧？",
    category: "values"
  },
  {
    question: "描述一次你学习新技能或领域的经历。",
    category: "experience"
  },
  {
    question: "你希望在5年后的创业路上达到什么样的成就？",
    category: "vision"
  },
  {
    question: "什么样的工作环境让你最有创造力？",
    category: "values"
  },
  {
    question: "分享一个你克服困难的具体例子。",
    category: "experience"
  },
  {
    question: "你认为AI/技术对你所在领域最大的机遇是什么？",
    category: "vision"
  },
  {
    question: "你如何平衡追求完美和快速迭代？",
    category: "values"
  },
  {
    question: "什么时候你意识到创业是你想要的道路？",
    category: "experience"
  },
  {
    question: "如果有无限资源，你最想解决什么问题？",
    category: "vision"
  },
  {
    question: "你如何定义成功的合作关系？",
    category: "values"
  },
  {
    question: "描述一次你改变了原有想法的经历。",
    category: "experience"
  },
  {
    question: "你觉得中国创业环境最大的优势和挑战是什么？",
    category: "vision"
  }
];

export async function seedIceBreakingQuestions() {
  console.log("Seeding ice-breaking questions...");
  
  for (const questionData of iceBreakingQuestions) {
    try {
      await storage.createQuestion(questionData);
      console.log(`Added question: ${questionData.question}`);
    } catch (error) {
      console.log(`Question might already exist: ${questionData.question}`);
    }
  }
  
  console.log("Ice-breaking questions seeding completed!");
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIceBreakingQuestions().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error("Error seeding questions:", error);
    process.exit(1);
  });
}