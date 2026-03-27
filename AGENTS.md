

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>backend-dev</name>
<description>作为后端专家，基于接口需求和数据库设计开发 Node.js 后端程序，并输出标准完整的正式 API 接口文档。Use when users ask for Node.js backend development, API implementation, service architecture, database-driven backend coding, or formal API documentation.</description>
<location>project</location>
</skill>

<skill>
<name>db-design</name>
<description>Design relational database schema (tables/fields/keys/ER diagram) from a uni-app mini program business workflow. Use this skill whenever the user mentions “数据库表设计/数据库建模/ER图/第三范式/Schema/数据模型/字段设计/主键外键/DDL/建表语句”，or when they provide a business flow and ask you to convert it into a database mode for efficient storage and correct mini-program behavior.</description>
<location>project</location>
</skill>

<skill>
<name>frontend-design</name>
<description>Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.</description>
<location>project</location>
</skill>

<skill>
<name>frontend-dev</name>
<description>作为前端专家开发高质量前端页面，尤其擅长 uni-app 小程序项目，并能梳理接口需求、输出接口需求文档以指导后端开发。Use when users ask for frontend development, uniapp/uni-app mini program pages, UI implementation, frontend architecture, or API requirement drafting.</description>
<location>project</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
